'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



// ─────────────────────────────────────────────────────────────────────────────
// bulkTrainPlayer
//
// Legacy bulk training via FanCoins (used by PlayerProfileModal).
// Training Camp level provides a discount (5% per level, max 50%).
// NOTE: The Phase 8 /base page now uses the atomic `upgrade_player_stat` RPC.
// This function is kept for backwards-compatibility with old squad sheet UI.
// ─────────────────────────────────────────────────────────────────────────────

export async function bulkTrainPlayer(
  userId: string,
  playerId: string,
  statIncreases: Record<string, number>
) {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) return { success: false, error: 'User not found' };

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, stats, ovr, potential_limit, stamina')
      .eq('id', playerId)
      .single();

    if (playerError || !player) return { success: false, error: 'Player not found' };
    if (player.team_id !== team.id) return { success: false, error: 'Player does not belong to your team' };

    // Training Camp discount
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('training_camp_level')
      .eq('team_id', team.id)
      .maybeSingle();

    const trainingLevel    = infra?.training_camp_level ?? 1;
    const discountPercent  = Math.min(0.50, trainingLevel * 0.05);
    const costPerStat      = Math.floor(500 * (1 - discountPercent));

    const currentStats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
    const newStats = { ...currentStats };
    let hasChanges = false;
    let totalStatsIncreased = 0;

    for (const [key, inc] of Object.entries(statIncreases)) {
      if (inc > 0) {
        newStats[key] = (newStats[key] || 50) + inc;
        hasChanges = true;
        totalStatsIncreased += inc;
      }
    }

    if (!hasChanges) return { success: false, error: 'No stats to upgrade' };

    const STAMINA_COST_PER_STAT = 5;
    const totalCost        = totalStatsIncreased * costPerStat;
    const totalStaminaCost = totalStatsIncreased * STAMINA_COST_PER_STAT;

    if (user.balance_fancoins < totalCost)   return { success: false, error: 'Insufficient FanCoins' };
    if ((player.stamina || 0) < totalStaminaCost) return { success: false, error: 'Not enough stamina' };

    const sum = ['pace', 'shooting', 'passing', 'defending', 'physical'].reduce(
      (acc, key) => acc + (newStats[key] || 50), 0
    );
    const newOvr = Math.floor(sum / 5.0);

    if (newOvr > player.potential_limit) {
      return { success: false, error: 'Cannot exceed player potential limit' };
    }

    const newBalance = user.balance_fancoins - totalCost;

    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductError) throw deductError;

    const newStamina = (player.stamina || 0) - totalStaminaCost;

    const { data: updatedPlayer, error: updateError } = await supabaseAdmin
      .from('players')
      .update({ stats: newStats, ovr: newOvr, stamina: newStamina })
      .eq('id', playerId)
      .select('*')
      .single();

    if (updateError) {
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', userId);
      throw updateError;
    }

    return { success: true, player: updatedPlayer, newBalance };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process bulk training' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// retirePlayer — Hall of Fame mechanic
//
// Permanently retires a legend card (OVR ≥ 85) from the active roster.
// In exchange the user earns a permanent global prestige_multiplier buff
// (+0.02 per legend) that compounds on all future FanCoin rewards.
//
// Loop: Grind SP → Train to 85+ OVR → Retire → +2% FC forever → repeat
// ─────────────────────────────────────────────────────────────────────────────

export async function retirePlayer(
  userId: string,
  playerId: string
): Promise<{ success: boolean; newMultiplier?: number; error?: string }> {
  try {
    // 1. Verify player belongs to user's team and meets OVR threshold
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, ovr, name')
      .eq('id', playerId)
      .single();

    if (playerError || !player) return { success: false, error: 'Player not found' };
    if (player.team_id !== team.id)  return { success: false, error: 'This player does not belong to your team' };
    if ((player.ovr || 0) < 85)      return { success: false, error: `${player.name} must reach OVR 85+ to be retired as a legend (current: ${player.ovr})` };

    // 2. Delete the legend card from the active roster
    const { error: deleteError } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteError) throw deleteError;

    // 3. Grant permanent prestige_multiplier buff (+0.02)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('prestige_multiplier')
      .eq('id', userId)
      .single();

    const currentMultiplier = Number(userData?.prestige_multiplier ?? 1.0);
    const newMultiplier     = Math.round((currentMultiplier + 0.02) * 10000) / 10000; // avoid float drift

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ prestige_multiplier: newMultiplier })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { success: true, newMultiplier };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retire player' };
  }
}
