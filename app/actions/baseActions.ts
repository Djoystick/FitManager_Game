'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getInjuredPlayers(userId: string) {
  try {
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

export async function healPlayer(userId: string, playerId: string) {
  try {

    // 1. Check user's balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    // 2. Fetch Medical Center Level to calculate discount
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('medical_center_level')
      .eq('team_id', team.id)
      .maybeSingle();

    const medicalLevel = infra?.medical_center_level || 1;
    const baseHealCost = 500;
    // 5% discount per level, max 50%
    const discountPercent = Math.min(0.50, medicalLevel * 0.05);
    const healCost = Math.floor(baseHealCost * (1 - discountPercent));

    if (user.balance_fancoins < healCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, is_injured')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (playerError || !player) {
      return { success: false, error: 'Player not found or does not belong to your team' };
    }

    if (!player.is_injured) {
      return { success: false, error: 'Player is already healthy' };
    }

    // 3. Deduct FanCoins
    const newBalance = user.balance_fancoins - healCost;
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductError) throw deductError;

    // 4. Heal Player
    const { error: healError } = await supabaseAdmin
      .from('players')
      .update({ is_injured: false, injury_matches_left: 0 })
      .eq('id', playerId);

    if (healError) {
      // Rollback balance (best effort in simple RPC-less flow)
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', userId);
      throw healError;
    }

    return { success: true, new_balance: newBalance, message: 'Player successfully healed.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to heal player' };
  }
}

export async function getStadiumData(userId: string) {
  try {
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

export async function upgradeStadium(userId: string) {
  try {
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

    // 4. Validate funds
    const currentLevel = infra.stadium_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    // 5. Transaction: Deduct coins, upgrade level
    const newBalance = user.balance_fancoins - upgradeCost;
    
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', user.id);

    if (deductError) throw deductError;

    const { error: upgradeError } = await supabaseAdmin
      .from('infrastructure')
      .update({ stadium_level: currentLevel + 1 })
      .eq('team_id', team.id);

    if (upgradeError) {
      // Rollback
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', user.id);
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
}

export async function forceInjuryDebug(userId: string) {
  try {
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

export async function upgradeMedicalCenter(userId: string) {
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
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('medical_center_level')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) return { success: false, error: 'Infrastructure not found' };

    const currentLevel = infra.medical_center_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    const newBalance = user.balance_fancoins - upgradeCost;
    
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', user.id);

    if (deductError) throw deductError;

    const { error: upgradeError } = await supabaseAdmin
      .from('infrastructure')
      .update({ medical_center_level: currentLevel + 1 })
      .eq('team_id', team.id);

    if (upgradeError) {
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', user.id);
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
}

export async function upgradeTrainingCenter(userId: string) {
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
      .eq('user_id', user.id)
      .single();

    if (teamError || !team) return { success: false, error: 'Team not found' };

    const { data: infra, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('training_camp_level')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) return { success: false, error: 'Infrastructure not found' };

    const currentLevel = infra.training_camp_level;
    const upgradeCost = currentLevel * 1000;

    if (user.balance_fancoins < upgradeCost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    const newBalance = user.balance_fancoins - upgradeCost;
    
    const { error: deductError } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', user.id);

    if (deductError) throw deductError;

    const { error: upgradeError } = await supabaseAdmin
      .from('infrastructure')
      .update({ training_camp_level: currentLevel + 1 })
      .eq('team_id', team.id);

    if (upgradeError) {
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', user.id);
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
}

