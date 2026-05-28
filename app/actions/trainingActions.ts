'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { matchService } from '@/services/matchService';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase service-role client (bypasses RLS for server actions)
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** New W2E stat keys (short form) */
export type StatKey = 'pac' | 'sta' | 'agi' | 'def' | 'dri' | 'pas' | 'phy' | 'sho';

/** Typed special currencies used for stat training */
export type SpecCurrencyType =
  | 'cardio_coin'
  | 'fitness_coin'
  | 'ball_coin'
  | 'strength_coin';

/** Club building types */
export type BuildingType = 'stadium' | 'medical' | 'academy' | 'scout';

export interface TrainStatResult {
  stat_name: string;
  old_value: number;
  new_value: number;
  cost: number;
  currency: string;
  new_ovr: number;
}

export interface ClubInfrastructure {
  stadium_level: number;
  medical_level: number;
  academy_level: number;
  scout_level: number;
  fancoins: number;
}

export interface PlayerForTraining {
  id: string;
  name: string;
  position: string;
  ovr: number;
  stats: Record<string, number>;
}

export interface TrainingCampData {
  players: PlayerForTraining[];
  currencies: {
    cardio_coin: number;
    fitness_coin: number;
    ball_coin: number;
    strength_coin: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('tg_user_id')?.value ?? null;
}

/** Maps BuildingType to its column in the infrastructure table */
const BUILDING_COLUMN_MAP: Record<BuildingType, string> = {
  stadium: 'stadium_level',
  medical: 'medical_center_level',
  academy: 'academy_level',
  scout:   'scout_level',
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: logTrainingSession
// Anti-cheat RPC wrapper — kept intact from Phase 7.
// ─────────────────────────────────────────────────────────────────────────────

export async function logTrainingSession(
  userId: string,
  durationMinutes: number,
  steps: number
) {
  try {
    const cookieStore = await cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (userId !== tgUserId) {
      return { success: false, error: 'Forbidden: User ID mismatch.' };
    }
    if (!userId) {
      return { success: false, error: 'User ID is required.' };
    }

    const sessionDate = new Date().toISOString().split('T')[0];
    const metValue = 5.0;
    const baseTp = Math.floor(steps / 100);

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'apply_overtraining_penalty',
      {
        p_user_id:    userId,
        p_session_date: sessionDate,
        p_base_tp:    baseTp,
        p_met:        metValue,
        p_duration:   durationMinutes,
        p_steps:      steps,
      }
    );

    if (rpcError) {
      console.error('[logTrainingSession] RPC Error:', rpcError);
      return { success: false, error: 'Database validation failed. Please try again.' };
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (result && result.session_status !== 'rejected') {
      const { error: updateError } = await supabase.rpc('sync_daily_steps', {
        u_id:       userId,
        steps_to_add: steps,
        today_date: sessionDate,
      });
      if (updateError) console.error('sync_daily_steps failed:', updateError);
    }

    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamData?.id) {
      matchService.invalidateTeamOVR(teamData.id);
    }

    revalidatePath('/training');

    return {
      success:  true,
      earnedTp: result.earned_tp,
      factor:   result.factor,
      status:   result.session_status,
    };
  } catch (error: any) {
    console.error('[logTrainingSession] Unexpected Error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: trainPlayerStatAction
//
// Thin wrapper over the `upgrade_player_stat` DB RPC which:
//   - Validates and locks both player + user rows FOR UPDATE
//   - Enforces the stat→currency binding matrix
//   - Applies progressive cost (5 / 10 / 25 / 60 / 120 / 300 coins)
//   - Atomically debits the currency and applies +1 to the stat in JSONB
//
// The DB RPC is the single source of truth for all business logic.
// Race condition protection lives at the DB level via FOR UPDATE locks.
// ─────────────────────────────────────────────────────────────────────────────

export async function trainPlayerStatAction(
  playerId: string,
  statKey: StatKey,
  currencyType: SpecCurrencyType
): Promise<{ success: boolean; data?: TrainStatResult; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    if (!playerId || !statKey || !currencyType) {
      return { success: false, error: 'Missing required parameters.' };
    }

    const { data, error } = await supabaseAdmin.rpc('upgrade_player_stat', {
      p_player_id:     playerId,
      p_stat_name:     statKey,
      p_currency_type: currencyType,
    });

    if (error) {
      console.error('[trainPlayerStatAction] RPC Error:', error);
      // Surface user-friendly balance errors from the DB RAISE EXCEPTION
      const msg = error.message?.includes('Insufficient')
        ? `Недостаточно монет: ${error.message}`
        : (error.message ?? 'Upgrade failed.');
      return { success: false, error: msg };
    }

    revalidatePath('/base');
    revalidatePath('/');

    return { success: true, data: data as TrainStatResult };
  } catch (err: any) {
    console.error('[trainPlayerStatAction] Unexpected error:', err);
    return { success: false, error: err.message ?? 'An unexpected error occurred.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: upgradeBuildingAction
//
// Unified building upgrade handler for all 4 club facilities:
//   stadium   → stadium_level       (+FanCoin income)
//   medical   → medical_center_level (+stamina recovery / heal discount)
//   academy   → academy_level        (+new player OVR genetics)
//   scout     → scout_level          (+perk drop chance)
//
// Cost formula: currentLevel × 1000 FanCoins
// ─────────────────────────────────────────────────────────────────────────────

export async function upgradeBuildingAction(
  buildingType: BuildingType
): Promise<{ success: boolean; new_level?: number; new_balance?: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    const column = BUILDING_COLUMN_MAP[buildingType];
    if (!column) return { success: false, error: `Unknown building type: ${buildingType}` };

    // Get user
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userErr || !user) return { success: false, error: 'User not found.' };

    // Get team
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found.' };

    // Get current infrastructure level
    const { data: infra, error: infraErr } = await supabaseAdmin
      .from('infrastructure')
      .select(column)
      .eq('team_id', team.id)
      .single();

    if (infraErr || !infra) return { success: false, error: 'Infrastructure record not found.' };

    const currentLevel = (infra as unknown as Record<string, number>)[column] ?? 1;
    // Exponential cost formula: FLOOR(500 × level^1.5)
    // Mirrors the SQL building_upgrade_cost() function in migration 00030.
    const upgradeCost  = Math.floor(500 * Math.pow(currentLevel, 1.5));

    if (user.balance_fancoins < upgradeCost) {
      return {
        success: false,
        error: `Недостаточно FanCoins. Нужно: ${upgradeCost.toLocaleString()}, есть: ${user.balance_fancoins.toLocaleString()}`,
      };
    }

    const newBalance = user.balance_fancoins - upgradeCost;

    // Deduct FanCoins
    const { error: deductErr } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductErr) throw deductErr;

    // Upgrade building level
    const { error: upgradeErr } = await supabaseAdmin
      .from('infrastructure')
      .update({ [column]: currentLevel + 1 })
      .eq('team_id', team.id);

    if (upgradeErr) {
      // Best-effort rollback
      await supabaseAdmin
        .from('users')
        .update({ balance_fancoins: user.balance_fancoins })
        .eq('id', userId);
      throw upgradeErr;
    }

    revalidatePath('/base');
    revalidatePath('/');

    return { success: true, new_level: currentLevel + 1, new_balance: newBalance };
  } catch (err: any) {
    console.error('[upgradeBuildingAction] Error:', err);
    return { success: false, error: err.message ?? 'Failed to upgrade building.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: getClubInfrastructureData
//
// Returns all 4 building levels + current FanCoin balance.
// Auto-creates the infrastructure row if it doesn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function getClubInfrastructureData(
  userId: string
): Promise<{ success: boolean; data?: ClubInfrastructure; error?: string }> {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userErr || !user) return { success: false, error: 'User not found.' };

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found.' };

    let { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('stadium_level, medical_center_level, academy_level, scout_level')
      .eq('team_id', team.id)
      .maybeSingle();

    // Auto-create if missing (should be handled by trigger, but safety fallback)
    if (!infra) {
      const { data: newInfra } = await supabaseAdmin
        .from('infrastructure')
        .insert({ team_id: team.id })
        .select('stadium_level, medical_center_level, academy_level, scout_level')
        .single();
      infra = newInfra;
    }

    if (!infra) return { success: false, error: 'Infrastructure not found.' };

    return {
      success: true,
      data: {
        stadium_level: infra.stadium_level      ?? 1,
        medical_level: infra.medical_center_level ?? 1,
        academy_level: infra.academy_level      ?? 1,
        scout_level:   infra.scout_level         ?? 1,
        fancoins:      user.balance_fancoins     ?? 0,
      },
    };
  } catch (err: any) {
    console.error('[getClubInfrastructureData] Error:', err);
    return { success: false, error: err.message ?? 'Failed to fetch infrastructure.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: getTrainingCampData
//
// Returns team players (sorted by OVR desc) + user's 4 currency balances.
// Used by the Training Camp tab.
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrainingCampData(
  userId: string
): Promise<{ success: boolean; data?: TrainingCampData; error?: string }> {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, cardio_coin, fitness_coin, ball_coin, strength_coin')
      .eq('id', userId)
      .single();

    if (userErr || !user) return { success: false, error: 'User not found.' };

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found.' };

    const { data: players, error: playersErr } = await supabaseAdmin
      .from('players')
      .select('id, name, position, ovr, stats')
      .eq('team_id', team.id)
      .order('ovr', { ascending: false });

    if (playersErr) throw playersErr;

    return {
      success: true,
      data: {
        players: (players ?? []) as PlayerForTraining[],
        currencies: {
          cardio_coin:   user.cardio_coin   ?? 0,
          fitness_coin:  user.fitness_coin  ?? 0,
          ball_coin:     user.ball_coin     ?? 0,
          strength_coin: user.strength_coin ?? 0,
        },
      },
    };
  } catch (err: any) {
    console.error('[getTrainingCampData] Error:', err);
    return { success: false, error: err.message ?? 'Failed to fetch training camp data.' };
  }
}
