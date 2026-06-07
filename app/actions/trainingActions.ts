'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { matchService } from '@/services/matchService';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { triggerTrainingAchievements, triggerInfrastructureAchievements } from '@/app/services/achievementService';

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

/** Club building types (main facilities) */
export type BuildingType = 'stadium' | 'medical' | 'academy' | 'scout';

/** Stadium sub-facility types */
export type StadiumFacilityType = 'pitch' | 'lighting' | 'seating' | 'services';

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
  // Ticket pricing (persisted in infrastructure table)
  ticket_price_league:   number;
  ticket_price_intcup:   number;
  ticket_price_natcup:   number;
  ticket_price_friendly: number;
  // Stadium sub-facilities (added migration 00044/00045)
  pitch_level:    number;
  lighting_level: number;
  seating_level:  number;
  services_level: number;
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
// ACTION: batchTrainPlayerAction
//
// Accepts multiple stat increments and processes them in a single transaction.
// Calculates costs progressively per stat.
// ─────────────────────────────────────────────────────────────────────────────

export async function batchTrainPlayerAction(
  playerId: string,
  increments: Record<StatKey, number>
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    
    // 1. Validate payload
    const keysToUpgrade = Object.keys(increments) as StatKey[];
    if (keysToUpgrade.length === 0) return { success: false, error: 'No stats to upgrade.' };

    // 2. Fetch player and team
    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id, team_id, stats, ovr')
      .eq('id', playerId)
      .single();
    if (playerErr || !player) return { success: false, error: 'Player not found.' };

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('user_id')
      .eq('id', player.team_id)
      .single();
    if (teamErr || !team || team.user_id !== userId) return { success: false, error: 'Unauthorized team.' };

    // 3. Fetch user balances
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, cardio_coin, fitness_coin, ball_coin, strength_coin')
      .eq('id', userId)
      .single();
    if (userErr || !user) return { success: false, error: 'User not found.' };

    // 4. Calculate progressive costs
    // ── Прогрессивная стоимость прокачки (Production-кривая) ────────────────
    // Новые тиры специально откалиброваны под 2 матча/день расписание:
    //   stat ≤ 60 →    5 монет  (быстрый старт, хукает новичка)
    //   stat ≤ 70 →   30 монет  (1–2 дня для среднего ходока)
    //   stat ≤ 78 →  120 монет  (≈1 неделя)
    //   stat ≤ 85 →  400 монет  (≈3 недели)
    //   stat ≤ 91 → 1200 монет  (≈7 недель, элита)
    //   stat > 91 → 4000 монет  (3–6+ месяцев, легенда)
    const getCost = (val: number): number => {
      if (val <= 60) return 5;
      if (val <= 70) return 30;
      if (val <= 78) return 120;
      if (val <= 85) return 400;
      if (val <= 91) return 1200;
      return 4000;
    };

    const currencyMap: Record<StatKey, SpecCurrencyType> = {
      pac: 'cardio_coin', sta: 'cardio_coin',
      agi: 'fitness_coin', def: 'fitness_coin',
      dri: 'ball_coin', pas: 'ball_coin',
      phy: 'strength_coin', sho: 'strength_coin',
    };

    const totalCosts: Record<SpecCurrencyType, number> = {
      cardio_coin: 0, fitness_coin: 0, ball_coin: 0, strength_coin: 0
    };

    const newStats = { ...(player.stats as Record<string, number>) };
    
    // Handle legacy stat mapping for calculation
    const legacyKeyMap: Record<StatKey, string> = { pac: 'pace', sho: 'shooting', pas: 'passing', def: 'defending', phy: 'physical', sta: 'sta', agi: 'agi', dri: 'dri' };

    for (const key of keysToUpgrade) {
      const inc = increments[key];
      if (inc <= 0) continue;

      let currentVal = newStats[key] ?? newStats[legacyKeyMap[key]] ?? 50;
      const curType = currencyMap[key];

      for (let i = 0; i < inc; i++) {
        if (currentVal >= 99) break; // Cannot exceed 99
        totalCosts[curType] += getCost(currentVal);
        currentVal++;
      }
      newStats[key] = currentVal;
    }

    // 5. Verify balances
    if (user.cardio_coin < totalCosts.cardio_coin ||
        user.fitness_coin < totalCosts.fitness_coin ||
        user.ball_coin < totalCosts.ball_coin ||
        user.strength_coin < totalCosts.strength_coin) {
      return { success: false, error: 'Недостаточно монет для всей операции.' };
    }

    // 6. Deduct balances
    const newBalances = {
      cardio_coin: user.cardio_coin - totalCosts.cardio_coin,
      fitness_coin: user.fitness_coin - totalCosts.fitness_coin,
      ball_coin: user.ball_coin - totalCosts.ball_coin,
      strength_coin: user.strength_coin - totalCosts.strength_coin,
    };

    const { error: updateBalErr } = await supabaseAdmin
      .from('users')
      .update(newBalances)
      .eq('id', userId);
    if (updateBalErr) return { success: false, error: 'Failed to update user balances.' };

    // 7. Recalculate OVR
    const getVal = (k: StatKey) => newStats[k] ?? newStats[legacyKeyMap[k]] ?? 50;
    const newOvr = Math.floor((getVal('pac') + getVal('sho') + getVal('pas') + getVal('def') + getVal('phy')) / 5.0);

    // 8. Update player (single query)
    const { error: updatePlErr } = await supabaseAdmin
      .from('players')
      .update({ stats: newStats, ovr: newOvr })
      .eq('id', playerId);
    
    if (updatePlErr) {
      // rollback best effort
      await supabaseAdmin.from('users').update({
        cardio_coin: user.cardio_coin, fitness_coin: user.fitness_coin, ball_coin: user.ball_coin, strength_coin: user.strength_coin
      }).eq('id', userId);
      return { success: false, error: 'Failed to update player stats.' };
    }

    // 9. Record OVR progression snapshot (only when OVR actually changed)
    if (newOvr !== (player.ovr as number)) {
      try {
        await supabaseAdmin.rpc('append_player_progression', {
          p_player_id: playerId,
          p_new_ovr:   newOvr,
        });
      } catch (progErr) {
        // Non-critical: log but don't fail the training action
        console.warn('[batchTrainPlayerAction] progression history write failed:', progErr);
      }
    }

    revalidatePath('/base');
    revalidatePath('/');

    await triggerTrainingAchievements(player.team_id);

    return { success: true };
  } catch (err: any) {
    console.error('[batchTrainPlayerAction] error:', err);
    return { success: false, error: err.message ?? 'Unknown error' };
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
    // Exponential cost formula: FLOOR(3000 × level^1.8) — raised from 800 in migration 00045
    //   lvl 1→2:    3,000 FC  | lvl 2→3:   10,392 FC | lvl 3→4:   23,148 FC
    //   lvl 5→6:   53,977 FC  | lvl 7→8:  107,650 FC | lvl 9→10: 182,900 FC
    // При 2 матчах/день стадион LVL10 займёт 6+ месяцев — правильный темп.
    const upgradeCost  = Math.floor(3000 * Math.pow(currentLevel, 1.8));

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

    await triggerInfrastructureAchievements(team.id);

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

    const INFRA_COLUMNS = [
      'stadium_level', 'medical_center_level', 'academy_level', 'scout_level',
      'ticket_price_league', 'ticket_price_intcup', 'ticket_price_natcup', 'ticket_price_friendly',
      'pitch_level', 'lighting_level', 'seating_level', 'services_level',
    ].join(', ');

    let { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select(INFRA_COLUMNS)
      .eq('team_id', team.id)
      .maybeSingle();

    // Auto-create if missing (should be handled by trigger, but safety fallback)
    if (!infra) {
      const { data: newInfra } = await supabaseAdmin
        .from('infrastructure')
        .insert({ team_id: team.id })
        .select(INFRA_COLUMNS)
        .single();
      infra = newInfra;
    }

    if (!infra) return { success: false, error: 'Infrastructure not found.' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const infraRow = (infra as any) as Record<string, unknown>;
    return {
      success: true,
      data: {
        stadium_level:          (infraRow.stadium_level          as number) ?? 1,
        medical_level:          (infraRow.medical_center_level   as number) ?? 1,
        academy_level:          (infraRow.academy_level          as number) ?? 1,
        scout_level:            (infraRow.scout_level            as number) ?? 1,
        fancoins:               (user.balance_fancoins                     ) ?? 0,
        ticket_price_league:    (infraRow.ticket_price_league    as number) ?? 20,
        ticket_price_intcup:    (infraRow.ticket_price_intcup    as number) ?? 30,
        ticket_price_natcup:    (infraRow.ticket_price_natcup    as number) ?? 25,
        ticket_price_friendly:  (infraRow.ticket_price_friendly  as number) ?? 10,
        // Sub-facilities (migration 00044/00045)
        pitch_level:            (infraRow.pitch_level            as number) ?? 1,
        lighting_level:         (infraRow.lighting_level         as number) ?? 1,
        seating_level:          (infraRow.seating_level          as number) ?? 1,
        services_level:         (infraRow.services_level         as number) ?? 1,
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

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: saveTicketPricesAction
//
// Persists the four ticket price values (league, intcup, natcup, friendly)
// into the team's infrastructure row.  Prices are clamped 0–999 FC.
// The match engine reads these in V4 to calculate matchday revenue.
// ─────────────────────────────────────────────────────────────────────────────

export async function saveTicketPricesAction(prices: {
  league:   number;
  intcup:   number;
  natcup:   number;
  friendly: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (teamErr || !team) return { success: false, error: 'Team not found.' };

    const clamp = (v: number) => Math.max(0, Math.min(999, Math.round(v)));

    const { error: updateErr } = await supabaseAdmin
      .from('infrastructure')
      .update({
        ticket_price_league:   clamp(prices.league),
        ticket_price_intcup:   clamp(prices.intcup),
        ticket_price_natcup:   clamp(prices.natcup),
        ticket_price_friendly: clamp(prices.friendly),
      })
      .eq('team_id', team.id);

    if (updateErr) throw updateErr;

    revalidatePath('/base');
    return { success: true };
  } catch (err: any) {
    console.error('[saveTicketPricesAction] error:', err);
    return { success: false, error: err.message ?? 'Failed to save ticket prices.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: upgradeStadiumFacilityAction
//
// Upgrades one of 4 stadium sub-facilities:
//   pitch    → Reduces injury chance by pitch_level × 2% per match
//   lighting → Unlocks evening matches (scheduling bonus)
//   seating  → Ticket revenue × (1 + seating_level × 0.05)
//   services → Passive +services_level × 30 FC per match
//
// Delegates to the upgrade_stadium_facility() Postgres RPC which acquires
// row-level locks on both users and infrastructure — race-condition safe.
//
// Cost formula: FLOOR(1500 × currentLevel^1.8)
//   lvl 1→2:  1,500 FC | lvl 3→4: 11,574 FC | lvl 5→6: 26,988 FC
//   lvl 7→8: 53,825 FC | lvl 9→10: 91,450 FC
// ─────────────────────────────────────────────────────────────────────────────

export async function upgradeStadiumFacilityAction(
  facilityType: StadiumFacilityType
): Promise<{ success: boolean; new_level?: number; new_balance?: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    const validTypes: StadiumFacilityType[] = ['pitch', 'lighting', 'seating', 'services'];
    if (!validTypes.includes(facilityType)) {
      return { success: false, error: `Invalid facility type: ${facilityType}` };
    }

    // Get team — ownership validated inside RPC too (double-check)
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found.' };

    // Delegate to atomic RPC (handles locking, balance check, level update)
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      'upgrade_stadium_facility',
      {
        p_team_id:  team.id,
        p_facility: facilityType,
        p_user_id:  userId,
      }
    );

    if (rpcErr) {
      console.error('[upgradeStadiumFacilityAction] RPC error:', rpcErr);
      const msg = rpcErr.message?.includes('Insufficient')
        ? `Недостаточно FanCoins: ${rpcErr.message.split('Required:')[1] ?? ''}`
        : rpcErr.message?.includes('maximum')
        ? 'Facility уже на максимальном уровне (10).'
        : rpcErr.message?.includes('Forbidden')
        ? 'Доступ запрещён.'
        : (rpcErr.message ?? 'Upgrade failed.');
      return { success: false, error: msg };
    }

    const result = rpcResult as {
      success: boolean;
      facility: string;
      new_level: number;
      cost: number;
      new_balance: number;
    };

    revalidatePath('/base');
    revalidatePath('/');

    return {
      success: true,
      new_level: result.new_level,
      new_balance: result.new_balance,
    };
  } catch (err: any) {
    console.error('[upgradeStadiumFacilityAction] error:', err);
    return { success: false, error: err.message ?? 'Failed to upgrade facility.' };
  }
}
