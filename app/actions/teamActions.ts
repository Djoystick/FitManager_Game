'use server';

import { createClient } from '@supabase/supabase-js';
import { executeBotSeeding } from '@/app/actions/adminActions';
import { generateLeagueSchedule } from '@/app/actions/calendarActions';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { containsProfanity } from '@/app/utils/censor';

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
  let stats: PlayerStats = {
    pace: Math.max(30, getRandomInt(45, 55)),
    shooting: Math.max(30, getRandomInt(45, 55)),
    passing: Math.max(30, getRandomInt(45, 55)),
    dribbling: Math.max(30, getRandomInt(45, 55)),
    defending: Math.max(30, getRandomInt(45, 55)),
    physical: Math.max(30, getRandomInt(45, 55)),
  };

  let traits: string[] = [];

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

    // === WIPE PHASE ===
    await supabaseAdmin.from('teams').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().like('telegram_id', 'bot_%');
    await supabaseAdmin.from('league_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

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

    const { error: playersError } = await supabaseAdmin
      .from('players')
      .insert(playersToInsert);

    if (playersError) {
      await supabaseAdmin.from('teams').delete().eq('id', newTeam.id);
      return { success: false, error: 'Failed to generate players, team creation rolled back' };
    }

    // === INFRASTRUCTURE ===
    await supabaseAdmin.from('infrastructure').insert({ team_id: newTeam.id });

    // === LEAGUE PLACEMENT (Tier 15) ===
    // 1. Find an open filling instance
    let instanceId;
    const { data: openInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id')
      .eq('tier_level', 15)
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
          tier_level: 15,
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
      // Trigger autofill cron asynchronously so the league fills up quickly with bots
      // We do this immediately so the user doesn't wait an hour for the cron to run.
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        fetch(`${appUrl}/api/cron/league-autofill`).catch(() => {});
      } catch (e) {
        console.warn("Failed to trigger autofill:", e);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("createStarterFranchise Error:", error);
    return { success: false, error: error.message || 'Internal Server Error' };
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

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
