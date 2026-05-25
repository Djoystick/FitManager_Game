'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function bulkTrainPlayer(
  userId: string, 
  playerId: string, 
  statIncreases: Record<string, number>
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



    // 2.5 Get Training Camp Level
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('training_camp_level')
      .eq('team_id', team.id)
      .maybeSingle();
      
    const trainingLevel = infra ? infra.training_camp_level : 1;
    const baseCostPerStat = 500;
    const discountPercent = Math.min(0.50, trainingLevel * 0.05);
    const costPerStat = Math.floor(baseCostPerStat * (1 - discountPercent));

    // 4. Calculate new stats & OVR & Cost
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
    
    const totalCost = totalStatsIncreased * costPerStat;

    // 3. Verify balance
    if (user.balance_fancoins < totalCost) return { success: false, error: 'Insufficient FanCoins' };

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

export async function healPlayerStamina(userId: string, playerId: string) {
  try {
    const costTP = 50;
    
    // 1. Fetch user & team
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, balance_tp')
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
      .select('id, team_id, stamina')
      .eq('id', playerId)
      .single();

    if (playerError || !player) return { success: false, error: 'Player not found' };
    if (player.team_id !== team.id) return { success: false, error: 'Player does not belong to your team' };

    // 3. Verify balance and stamina
    if (user.balance_tp < costTP) return { success: false, error: 'Insufficient TP' };
    if (player.stamina >= 100) return { success: false, error: 'Stamina is already full' };

    // 4. Transaction
    const newBalance = user.balance_tp - costTP;
    
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_tp: newBalance })
      .eq('id', userId);

    if (deductError) throw deductError;

    const { error: healError } = await supabaseAdmin
      .from('players')
      .update({ stamina: 100 })
      .eq('id', playerId);

    if (healError) {
      await supabaseAdmin.from('users').update({ balance_tp: user.balance_tp }).eq('id', userId);
      throw healError;
    }

    return { 
      success: true, 
      newBalance 
    };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to heal stamina' };
  }
}
