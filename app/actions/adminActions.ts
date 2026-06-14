'use server';

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { verifySession } from '@/lib/session';

export interface AdminActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

async function checkIsAdmin(sessionUuid: string, supabaseAdmin: any): Promise<boolean> {
  const { data: user } = await supabaseAdmin.from('users').select('telegram_id').eq('id', sessionUuid).single();
  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = user?.telegram_id ? String(user.telegram_id).trim() : '';
  return !!currentUserIdStr && adminIdsArray.includes(currentUserIdStr);
}

const FIRST_NAMES = ['Bot', 'Auto', 'Cyber', 'Neon', 'Meta', 'Holo', 'Quantum', 'Plasma', 'Aura', 'Zenith', 'Echo', 'Nexus', 'Apex'];
const LAST_NAMES = ['Strikers', 'United', 'City', 'FC', 'Athletic', 'Rovers', 'Wanderers', 'Dynamos', 'Titans', 'Legends', 'Force', 'Stars'];
const POSITIONS = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']; // Typical 4-4-2 distribution for 11 players

export async function executeBotSeeding(supabaseAdmin: any): Promise<AdminActionResult> {
  // 1. Generate 13 Bot Users
  const numBots = 13;
  const usersToInsert: any[] = [];
  for (let i = 0; i < numBots; i++) {
    usersToInsert.push({
      id: crypto.randomUUID(),
      telegram_id: `bot_${crypto.randomUUID()}`,
      balance_fancoins: Math.floor(Math.random() * 5000)
    });
  }

  const { data: insertedUsers, error: usersError } = await supabaseAdmin
    .from('users')
    .insert(usersToInsert)
    .select('id');

  if (usersError || !insertedUsers) {
    console.error("Bot Users Insert Error:", usersError);
    return { success: false, error: 'Failed to insert bot users.' };
  }

  // 2. Generate 13 Bot Teams linked to the new users
  const teamsToInsert = insertedUsers.map((user: any, idx: number) => {
    const fName = FIRST_NAMES[idx % FIRST_NAMES.length];
    const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: `${fName} ${lName}`,
      logo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
    };
  });

  const { data: insertedTeams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert(teamsToInsert)
    .select('id');

  if (teamsError || !insertedTeams) {
    console.error("Bot Teams Insert Error:", teamsError);
    return { success: false, error: 'Failed to insert bot teams.' };
  }

  // 3. Generate 16 Players for each of the 13 teams (208 players total)
  const playersToInsert: any[] = [];
  
  const pFirst = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew'];
  const pLast = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'];

  const BOT_POSITIONS = [
    { pos: 'GK', status: 'starting' },
    { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' },
    { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' },
    { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' },
    { pos: 'GK', status: 'bench' },
    { pos: 'DEF', status: 'bench' },
    { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' },
    { pos: 'FWD', status: 'bench' }
  ];

  insertedTeams.forEach((team: any) => {
    const teamBaseOvr = Math.floor(Math.random() * 16) + 30; // 30-45 OVR
    
    for (let i = 0; i < 16; i++) {
      const ovr = Math.max(30, Math.min(99, teamBaseOvr + Math.floor(Math.random() * 10 - 5)));
      const generateStat = () => Math.max(30, Math.min(99, Math.round(ovr + (Math.random() * 14 - 7))));
      
      const traitsRoll = Math.random();
      let numTraits = 0;
      if (traitsRoll >= 0.85) numTraits = 2;
      else if (traitsRoll >= 0.30) numTraits = 1;

      const traits: string[] = [];
      const availableTraits = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];
      for (let t = 0; t < numTraits; t++) {
        const idx = Math.floor(Math.random() * availableTraits.length);
        traits.push(availableTraits.splice(idx, 1)[0]);
      }

      playersToInsert.push({
        team_id: team.id,
        name: `${pFirst[Math.floor(Math.random() * pFirst.length)]} ${pLast[Math.floor(Math.random() * pLast.length)]}`,
        age: Math.floor(Math.random() * 15) + 18,
        ovr,
        potential_limit: Math.max(ovr, Math.floor(Math.random() * 10) + ovr),
        position: BOT_POSITIONS[i].pos,
        stats: {
          pace: generateStat(),
          shooting: generateStat(),
          passing: generateStat(),
          dribbling: generateStat(),
          defending: generateStat(),
          physical: generateStat(),
        },
        stamina: 100,
        lineup_status: BOT_POSITIONS[i].status,
        lineup_slot: i.toString(),
        is_nft_coach: false,
        traits
      });
    }
  });

  const { error: playersError } = await supabaseAdmin
    .from('players')
    .insert(playersToInsert);

  if (playersError) {
    console.error("Bot Players Insert Error:", playersError);
    return { success: false, error: 'Failed to insert bot players.' };
  }

  // 4. Generate League Standings entries for the 13 teams
  const standingsToInsert = insertedTeams.map((team: any) => ({
    team_id: team.id,
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goals_for: 0,
    goals_against: 0
  }));

  const { error: standingsError } = await supabaseAdmin
    .from('league_standings')
    .insert(standingsToInsert);

  if (standingsError) {
    console.error("Bot Standings Insert Error:", standingsError);
    return { success: false, error: 'Failed to initialize league standings for bots.' };
  }

  return { 
    success: true, 
    message: `Successfully seeded 13 bot teams, 143 players, and initialized their league standings.` 
  };
}

export async function seedBotLeague(): Promise<AdminActionResult> {
  try {
    const userId = await verifySession();

    if (!userId) {
      return { success: false, error: 'Unauthorized: Valid session required for Admin Actions.' };
    }

    // 0. Check Authorization (RBAC)
    const isAdmin = await checkIsAdmin(userId, supabase);
    if (!isAdmin) {
      return { success: false, error: 'Forbidden: Admin access required.' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    return await executeBotSeeding(supabaseAdmin);
  } catch (error: any) {
    console.error('Bot Seeder error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during seeding.' };
  }
}

export async function addSweatPoints(amount: number): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) {
      return { success: false, error: 'Forbidden: Admin access required.' };
    }

    const { data: userData } = await supabaseAdmin.from('users').select('sweat_points').eq('id', sessionUuid).single();
    
    const { error } = await supabaseAdmin.from('users').update({ sweat_points: (userData?.sweat_points || 0) + amount }).eq('id', sessionUuid);
    if (error) return { success: false, error: error.message };

    return { success: true, message: `Added ${amount} SP` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function hardResetUserTeam(userId: string): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) {
      return { success: false, error: 'Forbidden: Admin access required.' };
    }

    // Get user's team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (teamError) return { success: false, error: 'Database error fetching team.' };
    if (!team) return { success: false, error: 'User does not have a team to reset.' };

    // Delete the team (this will cascade delete players, standings, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('teams')
      .delete()
      .eq('id', team.id);

    if (deleteError) {
      console.error('Error deleting team:', deleteError);
      return { success: false, error: deleteError.message || 'Неизвестная ошибка базы данных' };
    }

    return { success: true, message: 'Team and all players have been hard reset. Please reload the app to create a new franchise.' };
  } catch (error: any) {
    console.error('Hard reset error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during reset.' };
  }
}

export async function addFanCoins(amount: number): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) return { success: false, error: 'Forbidden' };

    const { data: userData } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', sessionUuid).single();
    const { error } = await supabaseAdmin.from('users').update({ balance_fancoins: (userData?.balance_fancoins || 0) + amount }).eq('id', sessionUuid);
    if (error) return { success: false, error: error.message };

    return { success: true, message: `Added ${amount} FC` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addManagerXp(amount: number): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) return { success: false, error: 'Forbidden' };

    const { data: userData } = await supabaseAdmin.from('users').select('manager_xp').eq('id', sessionUuid).single();
    const { error } = await supabaseAdmin.from('users').update({ manager_xp: (userData?.manager_xp || 0) + amount }).eq('id', sessionUuid);
    if (error) return { success: false, error: error.message };

    return { success: true, message: `Added ${amount} XP` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function maxEnergy(): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) return { success: false, error: 'Forbidden' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', sessionUuid).single();
    if (!team) return { success: false, error: 'No team found' };

    const { error } = await supabaseAdmin.from('players').update({ stamina: 100, is_injured: false, injury_duration: 0 }).eq('team_id', team.id);
    if (error) return { success: false, error: error.message };

    return { success: true, message: `Maxed energy & healed all players` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function generateTopPlayer(): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) return { success: false, error: 'Forbidden' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', sessionUuid).single();
    if (!team) return { success: false, error: 'No team found' };

    const pFirst = ['Cristiano', 'Lionel', 'Kylian', 'Erling', 'Kevin'];
    const pLast = ['Ronaldo', 'Messi', 'Mbappe', 'Haaland', 'De Bruyne'];
    const ovr = 90 + Math.floor(Math.random() * 9);
    
    const { error } = await supabaseAdmin.from('players').insert({
      team_id: team.id,
      name: `${pFirst[Math.floor(Math.random() * pFirst.length)]} ${pLast[Math.floor(Math.random() * pLast.length)]}`,
      age: 25,
      ovr,
      potential_limit: ovr + 5,
      position: 'FWD',
      stats: { pace: ovr, shooting: ovr, passing: ovr-5, dribbling: ovr, defending: 40, physical: 80 },
      stamina: 100,
      lineup_status: 'bench',
      is_nft_coach: true,
      traits: ['Sniper', 'Speedster']
    });

    if (error) return { success: false, error: error.message };
    return { success: true, message: `Generated a top player (OVR ${ovr})!` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function forceMatchWin(): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const sessionUuid = (await verifySession());
    if (!sessionUuid) return { success: false, error: 'Unauthorized' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isAdmin = await checkIsAdmin(sessionUuid, supabaseAdmin);
    if (!isAdmin) return { success: false, error: 'Forbidden' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', sessionUuid).single();
    if (!team) return { success: false, error: 'No team found' };

    const { data: st } = await supabaseAdmin.from('league_standings').select('*').eq('team_id', team.id).single();
    if (st) {
      const { error } = await supabaseAdmin.from('league_standings').update({
        wins: (st.wins || 0) + 1,
        points: (st.points || 0) + 3,
        goals_for: (st.goals_for || 0) + 3,
        matches_played: (st.matches_played || 0) + 1
      }).eq('team_id', team.id);
      if (error) return { success: false, error: error.message };
    }
    
    return { success: true, message: `Forced a win (+3 pts)!` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
