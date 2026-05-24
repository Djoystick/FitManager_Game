'use server';

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface AdminActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

const FIRST_NAMES = ['Bot', 'Auto', 'Cyber', 'Neon', 'Meta', 'Holo', 'Quantum', 'Plasma', 'Aura', 'Zenith', 'Echo', 'Nexus', 'Apex'];
const LAST_NAMES = ['Strikers', 'United', 'City', 'FC', 'Athletic', 'Rovers', 'Wanderers', 'Dynamos', 'Titans', 'Legends', 'Force', 'Stars'];
const POSITIONS = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']; // Typical 4-4-2 distribution for 11 players

export async function seedBotLeague(): Promise<AdminActionResult> {
  try {
    const cookieStore = await cookies();
    const tgCookie = cookieStore.get('tg_user_id');
    const sessionUuid = tgCookie?.value;

    if (!sessionUuid) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required for Admin Actions.' };
    }

    // 0. Check Authorization (RBAC)
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', sessionUuid)
      .single();

    const rawAdminIds = process.env.ADMIN_TG_IDS || '';
    const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
    const currentUserIdStr = user?.telegram_id ? String(user.telegram_id).trim() : '';
    
    if (!currentUserIdStr || !adminIdsArray.includes(currentUserIdStr)) {
      return { success: false, error: 'Forbidden: Admin access required.' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
    const teamsToInsert = insertedUsers.map((user, idx) => {
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

    // 3. Generate 11 Players for each of the 13 teams (143 players total)
    const playersToInsert: any[] = [];
    
    // First Names and Last Names for players
    const pFirst = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew'];
    const pLast = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'];

    insertedTeams.forEach(team => {
      // Each team gets a random base OVR between 60 and 85
      const teamBaseOvr = Math.floor(Math.random() * 26) + 60;
      
      for (let i = 0; i < 11; i++) {
        const ovr = Math.max(1, Math.min(99, teamBaseOvr + Math.floor(Math.random() * 10 - 5)));
        const generateStat = () => Math.max(1, Math.min(99, Math.round(ovr + (Math.random() * 14 - 7))));
        
        playersToInsert.push({
          team_id: team.id,
          name: `${pFirst[Math.floor(Math.random() * pFirst.length)]} ${pLast[Math.floor(Math.random() * pLast.length)]}`,
          age: Math.floor(Math.random() * 15) + 18, // 18-32
          ovr,
          potential_limit: Math.max(ovr, Math.floor(Math.random() * 10) + ovr),
          position: POSITIONS[i],
          stats: {
            pace: generateStat(),
            shooting: generateStat(),
            passing: generateStat(),
            dribbling: generateStat(),
            defending: generateStat(),
            physical: generateStat(),
          },
          stamina: 100,
          lineup_status: 'starting',
          is_nft_coach: false
        });
      }
    });

    // Chunk the inserts just to be safe, though 143 is generally fine for Supabase, 
    // it's good practice for bulk operations.
    const { error: playersError } = await supabaseAdmin
      .from('players')
      .insert(playersToInsert);

    if (playersError) {
      console.error("Bot Players Insert Error:", playersError);
      return { success: false, error: 'Failed to insert bot players.' };
    }

    // 4. Generate League Standings entries for the 13 teams
    const standingsToInsert = insertedTeams.map(team => ({
      team_id: team.id,
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0
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

  } catch (error: any) {
    console.error('Bot Seeder error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during seeding.' };
  }
}
