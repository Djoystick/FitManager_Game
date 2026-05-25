'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function bulkTrainPlayer(
  userId: string, 
  playerId: string, 
  statIncreases: Record<string, number>, 
  totalCost: number
) {
  try {
    // 1. Fetch user & team
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

    // 2. Fetch Player
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, stats, ovr, potential_limit')
      .eq('id', playerId)
      .single();

    if (playerError || !player) return { success: false, error: 'Player not found' };
    if (player.team_id !== team.id) return { success: false, error: 'Player does not belong to your team' };

    // 3. Verify balance
    if (user.balance_fancoins < totalCost) return { success: false, error: 'Insufficient FanCoins' };

    // 4. Calculate new stats & OVR
    const currentStats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
    const newStats = { ...currentStats };
    let hasChanges = false;
    
    for (const [key, inc] of Object.entries(statIncreases)) {
      if (inc > 0) {
        newStats[key] = (newStats[key] || 50) + inc;
        hasChanges = true;
      }
    }

    if (!hasChanges) return { success: false, error: 'No stats to upgrade' };

    const sum = ['pace', 'shooting', 'passing', 'defending', 'physical'].reduce(
      (acc, key) => acc + (newStats[key] || 50), 0
    );
    const newOvr = Math.floor(sum / 5.0);

    // Verify potential limit
    if (newOvr > player.potential_limit) {
      return { success: false, error: 'Cannot exceed player potential limit' };
    }

    // 5. Execute transaction (Deduct balance, then update player)
    const newBalance = user.balance_fancoins - totalCost;
    
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductError) throw deductError;

    const { data: updatedPlayer, error: updateError } = await supabaseAdmin
      .from('players')
      .update({ stats: newStats, ovr: newOvr })
      .eq('id', playerId)
      .select('*')
      .single();

    if (updateError) {
      // Rollback
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', userId);
      throw updateError;
    }

    return { 
      success: true, 
      player: updatedPlayer,
      newBalance 
    };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process bulk training' };
  }
}
