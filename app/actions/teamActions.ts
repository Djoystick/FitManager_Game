'use server';

import { createClient } from '@supabase/supabase-js';
import { executeBotSeeding } from '@/app/actions/adminActions';
import { generateLeagueSchedule } from '@/app/actions/calendarActions';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { containsProfanity } from '@/app/utils/censor';
import { isNameBlacklisted } from '@/app/utils/blacklist';

export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const AVAILABLE_TRAITS = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];

function generatePlayer(
  teamId: string, 
  position: string, 
  lineup_status: string = 'starting', 
  lineup_slot: string | null = null,
  isCaptain: boolean = false
) {
  // Stat floor of 30 applied
  const stats: PlayerStats = {
    pace: Math.max(30, getRandomInt(45, 55)),
    shooting: Math.max(30, getRandomInt(45, 55)),
    passing: Math.max(30, getRandomInt(45, 55)),
    dribbling: Math.max(30, getRandomInt(45, 55)),
    defending: Math.max(30, getRandomInt(45, 55)),
    physical: Math.max(30, getRandomInt(45, 55)),
  };

  const traits: string[] = [];

  if (isCaptain) {
    stats.pace = getRandomInt(75, 85);
    stats.shooting = getRandomInt(80, 90);
    stats.passing = getRandomInt(80, 90);
    stats.dribbling = getRandomInt(80, 90);
    stats.defending = getRandomInt(65, 75);
    stats.physical = getRandomInt(70, 80);
    traits.push(Math.random() > 0.5 ? 'Sniper' : 'Playmaker');
  } else {
    const traitsRoll = Math.random();
    let numTraits = 0;
    if (traitsRoll >= 0.85) {
      numTraits = 2;
    } else if (traitsRoll >= 0.30) {
      numTraits = 1;
    }

    const available = [...AVAILABLE_TRAITS];
    for (let i = 0; i < numTraits; i++) {
      const idx = getRandomInt(0, available.length - 1);
      traits.push(available.splice(idx, 1)[0]);
    }
  }
  
  const ovr = Math.floor((stats.pace + stats.shooting + stats.passing + stats.dribbling! + stats.defending + stats.physical) / 6);
  const age = getRandomInt(18, 25);
  
  const firstNames = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mateo', 'Sebastian', 'Jack', 'Owen', 'Theodore'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  const name = `${firstNames[getRandomInt(0, firstNames.length - 1)]} ${lastNames[getRandomInt(0, lastNames.length - 1)]}`;
  
  return {
    team_id: teamId,
    name,
    age,
    ovr,
    potential_limit: getRandomInt(ovr + 5, 90),
    is_nft_coach: false,
    position,
    stats,
    stamina: 100,
    lineup_status,
    lineup_slot,
    traits
  };
}

export async function createStarterFranchise(teamName: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId || !teamName) {
      return { success: false, error: 'Missing userId or teamName' };
    }

    if (containsProfanity(teamName)) {
      return { success: false, error: 'error_censorship' }; // Special key for frontend dictionary
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // === CREATE PHASE ===
    const { data: newTeam, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({ user_id: userId, name: teamName })
      .select()
      .single();

    if (teamError || !newTeam) {
      return { success: false, error: 'Failed to create team' };
    }

    // === STARTER BONUS ===
    const { error: bonusError } = await supabaseAdmin
      .from('users')
      .update({
        balance_fancoins: 1000,
        sweat_points: 1000
      })
      .eq('id', userId);
      
    if (bonusError) {
      console.warn("Failed to give starter bonus:", bonusError);
    }

    // === PROCEDURAL SQUAD GENERATION (16 Players) ===
    const positions = [
      { pos: 'GK', status: 'starting' },
      { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' },
      { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' },
      { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' },
      { pos: 'GK', status: 'bench' },
      { pos: 'DEF', status: 'bench' },
      { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' },
      { pos: 'FWD', status: 'bench' }
    ];

    const fwdOrMidIndexes = positions
      .map((p, idx) => (p.pos === 'FWD' || p.pos === 'MID') ? idx : -1)
      .filter(idx => idx !== -1);
    const captainIndex = fwdOrMidIndexes[getRandomInt(0, fwdOrMidIndexes.length - 1)];

    const playersToInsert = positions.map((p, index) => 
      generatePlayer(newTeam.id, p.pos, p.status, index.toString(), index === captainIndex)
    );

    const { data: insertedPlayers, error: playersError } = await supabaseAdmin
      .from('players')
      .insert(playersToInsert)
      .select();

    if (playersError || !insertedPlayers) {
      await supabaseAdmin.from('teams').delete().eq('id', newTeam.id);
      return { success: false, error: 'Failed to generate players, team creation rolled back' };
    }

    // === INFRASTRUCTURE ===
    await supabaseAdmin.from('infrastructure').insert({ team_id: newTeam.id });

    // === LEAGUE PLACEMENT (Tier 10) ===
    // 1. Find an open filling instance
    let instanceId;
    const { data: openInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id')
      .eq('tier_level', 10)
      .eq('status', 'filling')
      .order('created_at', { ascending: true })
      .limit(1);

    if (openInstances && openInstances.length > 0) {
      instanceId = openInstances[0].id;
    } else {
      // Create new instance
      const { data: newInstance, error: instError } = await supabaseAdmin
        .from('league_instances')
        .insert({
          tier_level: 10,
          name: `Sector ${getRandomInt(100, 999)}`,
          status: 'filling'
        })
        .select('id')
        .single();
      
      if (instError || !newInstance) throw new Error("Failed to create league instance");
      instanceId = newInstance.id;
    }

    // 2. Insert into standings
    await supabaseAdmin.from('league_standings').insert({
      team_id: newTeam.id,
      league_instance_id: instanceId,
      points: 0
    });

    // 3. Check capacity
    const { count } = await supabaseAdmin
      .from('league_standings')
      .select('*', { count: 'exact', head: true })
      .eq('league_instance_id', instanceId);

    if (count && count >= 14) {
      // Instance is full, activate it and generate schedule
      await supabaseAdmin.from('league_instances').update({ status: 'active' }).eq('id', instanceId);
      
      // We pass the instanceId to generateLeagueSchedule so it only generates for this instance
      const calRes = await generateLeagueSchedule(instanceId);
      if (!calRes.success) console.warn(`Failed to generate schedule for instance ${instanceId}:`, calRes.error);
    } else {
      // Lobby mode enabled: we do NOT trigger the autofill immediately.
      // The frontend will show a countdown and trigger it after 60 seconds.
    }

    return { success: true, team: newTeam, players: insertedPlayers };
  } catch (error: any) {
    console.error("createStarterFranchise Error:", error);
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

// ==========================================
// NAMING ECONOMY (Phase 1)
// ==========================================

export async function renamePlayerAction(playerId: string, newName: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const cleanName = newName.trim();
    if (!cleanName || cleanName.length < 3 || cleanName.length > 25) {
      return { success: false, error: 'Name must be between 3 and 25 characters.' };
    }

    if (containsProfanity(cleanName)) {
      return { success: false, error: 'Name contains restricted words.' };
    }

    if (isNameBlacklisted(cleanName)) {
      return { success: false, error: 'This name is protected by FIFPro and cannot be used.' };
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Verify ownership and get user balance
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found' };

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (playerErr || !player) return { success: false, error: 'Player not found or not owned by you.' };

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .single();

    if (userErr || !user) return { success: false, error: 'User not found' };

    const RENAME_COST = 1000;
    if ((user.balance_fancoins || 0) < RENAME_COST) {
      return { success: false, error: `Insufficient FanCoins. Need ${RENAME_COST} FC.` };
    }

    // 2. Check for unique name globally
    const { data: existingName } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('name', cleanName)
      .maybeSingle();

    if (existingName) {
      return { success: false, error: 'This name is already taken by another player globally.' };
    }

    // 3. Deduct FC
    const newBalance = (user.balance_fancoins || 0) - RENAME_COST;
    const { error: deductErr } = await supabaseAdmin
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductErr) return { success: false, error: 'Failed to deduct FanCoins' };

    // 4. Update Name
    const { error: updateErr } = await supabaseAdmin
      .from('players')
      .update({ name: cleanName })
      .eq('id', playerId);

    if (updateErr) {
      // Refund
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins }).eq('id', userId);
      return { success: false, error: 'Failed to rename player' };
    }

    return { success: true };

  } catch (err: any) {
    console.error('[TeamActions] renamePlayerAction error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}


export async function renameTeamAction(newName: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    
    if (!userId || !newName) return { success: false, error: 'Missing data' };
    if (containsProfanity(newName)) return { success: false, error: 'error_censorship' };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check user balance
    const { data: user } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', userId).single();
    if (!user || user.balance_fancoins < 1000) {
      return { success: false, error: 'error_insufficient_fc' };
    }

    // 2. Deduct 1000 FC
    const { error: deductError } = await supabaseAdmin.rpc('decrement_fancoins', {
      user_id: userId,
      amount: 1000
    });

    if (deductError) {
      // Fallback if rpc doesn't exist
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins - 1000 }).eq('id', userId);
    }

    // 3. Update team name
    const { error: updateError } = await supabaseAdmin.from('teams').update({ name: newName }).eq('user_id', userId);
    
    if (updateError) return { success: false, error: 'rename_error' };

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function changeLogoAction(logoUrl: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    
    if (!userId || !logoUrl) return { success: false, error: 'Missing data' };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check user balance
    const { data: user } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', userId).single();
    if (!user || user.balance_fancoins < 500) {
      return { success: false, error: 'error_insufficient_fc' };
    }

    // 2. Deduct 500 FC
    const { error: deductError } = await supabaseAdmin.rpc('decrement_fancoins', {
      user_id: userId,
      amount: 500
    });

    if (deductError) {
      // Fallback
      await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins - 500 }).eq('id', userId);
    }

    // 3. Update team logo
    const { error: updateError } = await supabaseAdmin.from('teams').update({ logo_url: logoUrl }).eq('user_id', userId);
    
    if (updateError) return { success: false, error: 'logo_error' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (team) {
      const { checkAndUnlockAchievement } = await import('@/app/services/achievementService');
      await checkAndUnlockAchievement(team.id, 'FACE_REVEAL');
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// MENTORSHIP / RETIREMENT (Phase 2)
// ==========================================

export async function retirePlayerToAcademy(playerId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    
    if (!userId || !playerId) return { success: false, error: 'Missing data' };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get user's team
    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    // 2. Fetch the player
    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id, ovr, position, is_retired')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (playerErr || !player) return { success: false, error: 'Player not found or not owned by you.' };
    if (!player.is_retired) return { success: false, error: 'Player is not retired yet (Must be 35+ years old).' };

    // 3. Calculate Academy Perk based on OVR & Position
    let perkBonus = 0.05; // Base 5% chance
    if (player.ovr >= 75) perkBonus = 0.15;
    else if (player.ovr >= 65) perkBonus = 0.10;

    let perkType = 'generic_boost';
    if (player.position === 'FWD') perkType = 'scout_fwd_boost';
    else if (player.position === 'MID') perkType = 'scout_mid_boost';
    else if (player.position === 'DEF') perkType = 'scout_def_boost';
    else if (player.position === 'GK') perkType = 'scout_gk_boost';

    const newPerk = { type: perkType, bonus_chance: perkBonus, from_ovr: player.ovr };

    // 4. Update infrastructure.academy_perks
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('academy_perks')
      .eq('team_id', team.id)
      .maybeSingle();

    const existingPerks = infra?.academy_perks ? (Array.isArray(infra.academy_perks) ? infra.academy_perks : []) : [];
    const updatedPerks = [...existingPerks, newPerk];

    const { error: infraErr } = await supabaseAdmin
      .from('infrastructure')
      .update({ academy_perks: updatedPerks })
      .eq('team_id', team.id);

    if (infraErr) throw new Error('Failed to update academy perks');

    // 5. Delete player (Burn)
    const { error: deleteErr } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteErr) {
      console.error("Failed to delete player after granting perk:", deleteErr);
      return { success: false, error: 'Failed to burn player' };
    }

    return { success: true, granted_perk: newPerk };
  } catch (err: any) {
    console.error('[retirePlayerToAcademy] Error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ==========================================
// QUICK SELL (ECONOMY SINK)
// ==========================================

export async function quickSellPlayer(playerId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    
    if (!userId || !playerId) return { success: false, error: 'Missing data' };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get user and team
    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    // 2. Fetch the player
    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('id, ovr, lineup_status, is_retired')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (playerErr || !player) return { success: false, error: 'Player not found or not owned by you.' };
    
    // Safety check - cannot sell starting 11
    if (player.lineup_status === 'starting') {
      return { success: false, error: 'Cannot quick sell a player from starting 11. Move to bench first.' };
    }
    if (player.is_retired) {
      return { success: false, error: 'Retired players cannot be sold for FC.' };
    }

    // 3. Calculate FC payout
    // Formula: (OVR - 40) * 100. Minimum payout is 100 FC.
    let payout = (player.ovr - 40) * 100;
    if (payout < 100) payout = 100;

    // 4. Delete player (Burn)
    const { error: deleteErr } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteErr) {
      return { success: false, error: 'Failed to delete player' };
    }

    // 5. Add FanCoins to user
    const { error: incrementError } = await supabaseAdmin.rpc('increment_fancoins', {
      user_id: userId,
      amount: payout
    });

    // Fallback if RPC fails
    if (incrementError) {
      const { data: user } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', userId).single();
      if (user) {
        await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins + payout }).eq('id', userId);
      }
    }

    return { success: true, payout };
  } catch (err: any) {
    console.error('[quickSellPlayer] Error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

