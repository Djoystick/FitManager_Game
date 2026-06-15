'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getInjuredPlayers() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    // 1. Get user's team
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    // 2. Fetch injured players
    const { data: injuredPlayers, error } = await supabaseAdmin
      .from('players')
      .select('id, name, position, overall_rating')
      .eq('team_id', team.id)
      .eq('is_injured', true);

    if (error) throw error;

    return { success: true, players: injuredPlayers || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch injured players' };
  }
}

export async function healPlayer(playerId: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, is_injured, stamina')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (playerError || !player) {
      return { success: false, error: 'Player not found or does not belong to your team' };
    }

    const currentStamina = player.stamina ?? 100;
    if (!player.is_injured && currentStamina >= 100) {
      return { success: false, error: 'Player is already fully healthy' };
    }

    // Calculate SP Cost (1 missing stamina = 1 SP) with Medical Center discount
    const baseSpCost = Math.max(0, 100 - currentStamina);

    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('medical_center_level')
      .eq('team_id', team.id)
      .maybeSingle();
    const medLevel = infra?.medical_center_level ?? 1;
    const discount = Math.min(0.20, Math.max(0, (medLevel - 1) * 0.10));
    const spCost = Math.floor(baseSpCost * (1 - discount));

    // Deduct SP via atomic RPC
    const { data: newBalance, error: deductError } = await supabaseAdmin
      .rpc('deduct_sweat_points', { u_id: userId, amount: spCost });

    if (deductError) {
      return { success: false, error: 'Not enough Sweat Points or deduction failed' };
    }

    // Heal Player (restore stamina + clear injury)
    const { error: healError } = await supabaseAdmin
      .from('players')
      .update({ is_injured: false, injury_matches_left: 0, stamina: 100 })
      .eq('id', playerId);

    if (healError) {
      // Refund on failure
      await supabaseAdmin.rpc('increment_sweat_points', { u_id: userId, amount: spCost });
      throw healError;
    }

    return { success: true, new_balance: newBalance, message: 'Player successfully healed.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to heal player' };
  }
}

export async function getStadiumData() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    // 1. Get user uuid and balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    // 2. Get team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    // 3. Get or Upsert infrastructure
    // eslint-disable-next-line prefer-const
    let { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('stadium_level, medical_center_level, training_camp_level')
      .eq('team_id', team.id)
      .single();

    if (!infra || infraError) {
      const { data: newInfra, error: insertError } = await supabaseAdmin
        .from('infrastructure')
        .insert({ team_id: team.id, stadium_level: 1, medical_center_level: 1, training_camp_level: 1 })
        .select('stadium_level, medical_center_level, training_camp_level')
        .single();
        
      if (insertError) throw insertError;
      infra = newInfra;
    }

    return { 
      success: true, 
      stadium_level: infra.stadium_level,
      medical_center_level: infra.medical_center_level,
      training_camp_level: infra.training_camp_level,
      fancoins: user.balance_fancoins 
    };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch stadium data' };
  }
}

export async function upgradeStadium() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    // 1. Get user uuid and balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    // 2. Get team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    // 3. Get infrastructure
    const { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('stadium_level')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) return { success: false, error: 'Infrastructure not found' };

    // P0-2 FIX: Economic lockout — cannot upgrade while bankrupt
    if ((user.balance_fancoins ?? 0) === 0) {
      return { success: false, error: 'Cannot upgrade while bankrupt. Win a match to recover.' };
    }

    // 4. Validate funds
    const currentLevel = infra.stadium_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    // 5. Atomic deduction via RPC (prevents race condition)
    try {
      const { data: newBalance, error: deductError } = await supabaseAdmin
        .rpc('deduct_fancoins', { user_id: user.id, amount: upgradeCost });

      if (deductError) throw deductError;

      const { error: upgradeError } = await supabaseAdmin
        .from('infrastructure')
        .update({ stadium_level: currentLevel + 1 })
        .eq('team_id', team.id);

      if (upgradeError) {
        // Rollback: refund the deduction
        await supabaseAdmin.rpc('increment_fancoins', { u_id: user.id, amount: upgradeCost });
        throw upgradeError;
      }

      return {
        success: true,
        new_level: currentLevel + 1,
        new_balance: newBalance
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upgrade stadium' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upgrade stadium' };
  }
}

export async function forceInjuryDebug() {
  try {
    if (process.env.NODE_ENV !== 'development') return { success: false, error: 'Dev only' };
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: player, error: fetchError } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('team_id', team.id)
      .eq('lineup_status', 'starting')
      .eq('is_injured', false)
      .limit(1)
      .single();

    if (fetchError || !player) return { success: false, error: 'No healthy starting players found' };

    const { error: updateError } = await supabaseAdmin
      .from('players')
      .update({ is_injured: true })
      .eq('id', player.id);

    if (updateError) return { success: false, error: updateError.message };

    return { success: true, playerName: player.name };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to force injury' };
  }
}

export async function upgradeMedicalCenter() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('medical_center_level')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) return { success: false, error: 'Infrastructure not found' };

    // P0-2 FIX: Economic lockout — cannot upgrade while bankrupt
    if ((user.balance_fancoins ?? 0) === 0) {
      return { success: false, error: 'Cannot upgrade while bankrupt. Win a match to recover.' };
    }

    const currentLevel = infra.medical_center_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    // Atomic deduction via RPC
    try {
      const { data: newBalance, error: deductError } = await supabaseAdmin
        .rpc('deduct_fancoins', { user_id: user.id, amount: upgradeCost });

      if (deductError) throw deductError;

      const { error: upgradeError } = await supabaseAdmin
        .from('infrastructure')
        .update({ medical_center_level: currentLevel + 1 })
        .eq('team_id', team.id);

      if (upgradeError) {
        await supabaseAdmin.rpc('increment_fancoins', { u_id: user.id, amount: upgradeCost });
        throw upgradeError;
      }

      return {
        success: true,
        new_level: currentLevel + 1,
        new_balance: newBalance
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upgrade medical center' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upgrade medical center' };
  }
}

export async function upgradeTrainingCenter() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('training_camp_level')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) return { success: false, error: 'Infrastructure not found' };

    // P0-2 FIX: Economic lockout — cannot upgrade while bankrupt
    if ((user.balance_fancoins ?? 0) === 0) {
      return { success: false, error: 'Cannot upgrade while bankrupt. Win a match to recover.' };
    }

    const currentLevel = infra.training_camp_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    // Atomic deduction via RPC
    try {
      const { data: newBalance, error: deductError } = await supabaseAdmin
        .rpc('deduct_fancoins', { user_id: user.id, amount: upgradeCost });

      if (deductError) throw deductError;

      const { error: upgradeError } = await supabaseAdmin
        .from('infrastructure')
        .update({ training_camp_level: currentLevel + 1 })
        .eq('team_id', team.id);

      if (upgradeError) {
        await supabaseAdmin.rpc('increment_fancoins', { u_id: user.id, amount: upgradeCost });
        throw upgradeError;
      }

      return {
        success: true,
        new_level: currentLevel + 1,
        new_balance: newBalance
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upgrade training center' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upgrade training center' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// healAllPlayers
//
// Restores stamina to 100% for ALL players below 100 on the user's team.
// Charges SP per player.
// Used by the "Heal All" button in the Lineup screen.
// ─────────────────────────────────────────────────────────────────────────────

export async function healAllPlayers(): Promise<{
  success: boolean;
  playersHealed?: number;
  new_balance?: number;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    // Find all players needing healing
    const { data: needsHeal } = await supabaseAdmin
      .from('players')
      .select('id, stamina, is_injured')
      .eq('team_id', team.id)
      .or('stamina.lt.100,is_injured.eq.true');

    if (!needsHeal || needsHeal.length === 0) {
      return { success: true, playersHealed: 0, new_balance: 0 };
    }

    // Fetch Medical Center level for discount
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('medical_center_level')
      .eq('team_id', team.id)
      .maybeSingle();
    const medLevel = infra?.medical_center_level ?? 1;
    const discount = Math.min(0.20, Math.max(0, (medLevel - 1) * 0.10));

    let totalCost = 0;
    needsHeal.forEach(p => {
      const baseCost = Math.max(0, 100 - (p.stamina ?? 100));
      totalCost += Math.floor(baseCost * (1 - discount));
    });

    // Deduct SP via atomic RPC
    const { data: newBalance, error: deductErr } = await supabaseAdmin
      .rpc('deduct_sweat_points', { u_id: userId, amount: totalCost });

    if (deductErr) {
      return {
        success: false,
        error: `Not enough Sweat Points. Need ${totalCost} SP to heal ${needsHeal.length} players.`,
      };
    }

    const ids = needsHeal.map(p => p.id);
    const { error: healErr } = await supabaseAdmin
      .from('players')
      .update({ stamina: 100, is_injured: false, injury_matches_left: 0 })
      .in('id', ids);

    if (healErr) {
      // Refund on failure
      await supabaseAdmin.rpc('increment_sweat_points', { u_id: userId, amount: totalCost });
      throw healErr;
    }

    return { success: true, playersHealed: needsHeal.length, new_balance: newBalance };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to bulk heal players' };
  }
}
