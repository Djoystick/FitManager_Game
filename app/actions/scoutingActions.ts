'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  age: number;
  ovr: number;
  potential_limit: number;
  position: string;
  stats: PlayerStats;
  stamina: number;
  lineup_status: string;
  is_nft_coach: boolean;
}

export interface ScoutResult {
  success: boolean;
  player?: Player;
  error?: string;
}

const FIRST_NAMES = ['Lamine', 'Endrick', 'Jude', 'Pedri', 'Gavi', 'Kobbie', 'Alejandro', 'Jamal', 'Florian', 'Arda', 'Mathys', 'Evan', 'Xavi'];
const LAST_NAMES = ['Yamal', 'Bellingham', 'Mainoo', 'Garnacho', 'Musiala', 'Wirtz', 'Guler', 'Tel', 'Ferguson', 'Simons', 'Paz', 'Zaïre-Emery'];
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

function generateRandomPlayer(teamId: string): Omit<Player, 'id'> {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  
  const age = Math.floor(Math.random() * 4) + 16; // 16 to 19
  const ovr = Math.floor(Math.random() * 21) + 55; // 55 to 75
  const potentialLimit = Math.floor(Math.random() * (99 - (ovr + 5) + 1)) + (ovr + 5); // OVR+5 to 99

  // Generate stats clustered around OVR
  const generateStat = () => Math.min(99, Math.max(1, Math.round(ovr + (Math.random() * 20 - 10))));
  
  const stats: PlayerStats = {
    pace: generateStat(),
    shooting: generateStat(),
    passing: generateStat(),
    dribbling: generateStat(),
    defending: generateStat(),
    physical: generateStat(),
  };

  // Adjust stats slightly based on position
  if (position === 'FWD') {
    stats.shooting = Math.min(99, stats.shooting + 10);
    stats.pace = Math.min(99, stats.pace + 5);
  } else if (position === 'MID') {
    stats.passing = Math.min(99, stats.passing + 10);
    stats.dribbling = Math.min(99, stats.dribbling + 5);
  } else if (position === 'DEF') {
    stats.defending = Math.min(99, stats.defending + 15);
    stats.physical = Math.min(99, stats.physical + 5);
  } else if (position === 'GK') {
    stats.defending = Math.min(99, stats.defending + 20); // GK reflexes abstractly stored as defending
  }

  return {
    team_id: teamId,
    name: `${firstName} ${lastName}`,
    age,
    ovr,
    potential_limit: potentialLimit,
    position,
    stats,
    stamina: 100,
    lineup_status: 'bench',
    is_nft_coach: false,
  };
}

export async function scoutYouthPlayer(): Promise<ScoutResult> {
  try {
    const cookieStore = await cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    // 1. Fetch user's team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !teamData) {
      return { success: false, error: 'Team not found for the current user.' };
    }

    const teamId = teamData.id;

    // 2. Generate the player
    const newPlayer = generateRandomPlayer(teamId);

    // 3. Insert into database
    const { data: insertedPlayer, error: insertError } = await supabase
      .from('players')
      .insert(newPlayer)
      .select('*')
      .single();

    if (insertError || !insertedPlayer) {
      console.error("Scouting Error:", insertError);
      return { success: false, error: 'Failed to sign the new player. Academy network error.' };
    }

    revalidatePath('/squad');
    revalidatePath('/academy');

    return {
      success: true,
      player: insertedPlayer as Player
    };

  } catch (error: any) {
    console.error('Youth Scouting error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during scouting.' };
  }
}
