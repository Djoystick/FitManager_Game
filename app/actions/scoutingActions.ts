'use server';

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  sta: number;
  agi: number;
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
  traits?: string[];
  lineup_status: string;
  is_nft_coach: boolean;
}

export interface ScoutResult {
  success: boolean;
  player?: Player;
  academy_bonus?: number;
  perk_granted?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Lamine', 'Endrick', 'Jude', 'Pedri', 'Gavi', 'Kobbie',
  'Alejandro', 'Jamal', 'Florian', 'Arda', 'Mathys', 'Evan', 'Xavi',
];
const LAST_NAMES = [
  'Yamal', 'Bellingham', 'Mainoo', 'Garnacho', 'Musiala', 'Wirtz',
  'Guler', 'Tel', 'Ferguson', 'Simons', 'Paz', 'Zaïre-Emery',
];
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// Available perks for the perk drop system
const AVAILABLE_PERKS = [
  'pace_demon', 'iron_wall', 'playmaker', 'clinical', 'workhorse',
  'aerial_threat', 'long_shot', 'captain', 'sniper', 'marathon_man',
];

// ─────────────────────────────────────────────────────────────────────────────
// Player generation — now infrastructure-aware
//
// Academy level bonuses (OVR genetics):
//   Each academy level adds +2 to the base OVR floor.
//   Level 1 → 55–75 OVR  (unchanged baseline)
//   Level 5 → 63–83 OVR  (+8 bonus)
//   Level 10 → 73–93 OVR (+18 bonus, capped at 93 to preserve growth room)
//
// Scout level perk probability:
//   Base chance = 10%, each scout level adds +5%.
//   Level 1 → 15%,  Level 5 → 35%,  Level 10 → 60%
// ─────────────────────────────────────────────────────────────────────────────

function generateRandomPlayer(
  teamId: string,
  academyLevel: number = 1,
  scoutLevel: number   = 1
): Omit<Player, 'id'> & { perk_granted: boolean } {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName  = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const position  = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const age       = Math.floor(Math.random() * 4) + 16; // 16–19

  // Academy OVR bonus: +2 per level, capped so floor+range don't exceed 93
  const academyBonus = Math.min((academyLevel - 1) * 2, 18);
  const ovrFloor     = Math.min(55 + academyBonus, 73);
  const ovr          = Math.floor(Math.random() * 21) + ovrFloor; // floor → floor+20
  const potentialLimit = Math.min(99, Math.floor(Math.random() * (99 - (ovr + 5) + 1)) + (ovr + 5));

  // Generate stats clustered around OVR (Phase 8 W2E keys)
  const genStat = () => Math.min(99, Math.max(1, Math.round(ovr + (Math.random() * 20 - 10))));

  const stats: PlayerStats = {
    pac: genStat(),
    sho: genStat(),
    pas: genStat(),
    dri: genStat(),
    def: genStat(),
    phy: genStat(),
    sta: genStat(),
    agi: genStat(),
  };

  // Position-based stat adjustments
  if (position === 'FWD') {
    stats.sho = Math.min(99, stats.sho + 10);
    stats.pac = Math.min(99, stats.pac + 5);
  } else if (position === 'MID') {
    stats.pas = Math.min(99, stats.pas + 10);
    stats.dri = Math.min(99, stats.dri + 5);
  } else if (position === 'DEF') {
    stats.def = Math.min(99, stats.def + 15);
    stats.phy = Math.min(99, stats.phy + 5);
  } else if (position === 'GK') {
    stats.def = Math.min(99, stats.def + 20);
    stats.phy = Math.min(99, stats.phy + 5);
  }

  // Scout perk drop: 10% base + 5% per scout level
  const perkChance = Math.min(0.10 + (scoutLevel * 0.05), 0.75); // max 75%
  const perk_granted = Math.random() < perkChance;
  const traits: string[] = perk_granted
    ? [AVAILABLE_PERKS[Math.floor(Math.random() * AVAILABLE_PERKS.length)]]
    : [];

  return {
    team_id:       teamId,
    name:          `${firstName} ${lastName}`,
    age,
    ovr,
    potential_limit: potentialLimit,
    position,
    stats,
    stamina:       100,
    lineup_status: 'bench',
    is_nft_coach:  false,
    traits,
    perk_granted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: scoutYouthPlayer
//
// Reads academy_level + scout_level from infrastructure before generating.
// ─────────────────────────────────────────────────────────────────────────────

export async function scoutYouthPlayer(): Promise<ScoutResult> {
  try {
    const cookieStore = await cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    // 1. Fetch user's team
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !teamData) {
      return { success: false, error: 'Team not found for the current user.' };
    }

    const teamId = teamData.id;

    // 2. Read infrastructure levels (academy + scout)
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('academy_level, scout_level')
      .eq('team_id', teamId)
      .maybeSingle();

    const academyLevel = infra?.academy_level ?? 1;
    const scoutLevel   = infra?.scout_level   ?? 1;

    // 3. Generate player with infrastructure bonuses
    const { perk_granted, ...newPlayerData } = generateRandomPlayer(teamId, academyLevel, scoutLevel);

    // 4. Insert into database
    const { data: insertedPlayer, error: insertError } = await supabaseAdmin
      .from('players')
      .insert(newPlayerData)
      .select('*')
      .single();

    if (insertError || !insertedPlayer) {
      console.error('Scouting Error:', insertError);
      return { success: false, error: 'Failed to sign the new player. Academy network error.' };
    }

    revalidatePath('/squad');
    revalidatePath('/academy');

    return {
      success:        true,
      player:         insertedPlayer as Player,
      academy_bonus:  (academyLevel - 1) * 2,
      perk_granted,
    };

  } catch (error: any) {
    console.error('Youth Scouting error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during scouting.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY: getNextOpponentData
//
// Returns opponent info filtered by the user's Scout level (Fog of War):
//
//   scout_level 1-2: Only total OVR (squad is hidden)
//   scout_level 3-4: Names + formation visible; stats and perks hidden
//   scout_level 5+ : Full access — stats and perks visible
// ─────────────────────────────────────────────────────────────────────────────

export type FogOfWarLevel = 'hidden' | 'partial' | 'full';

export interface OpponentData {
  team_id:       string;
  team_name:     string;
  avg_ovr:       number;
  fog_level:     FogOfWarLevel;
  scout_level:   number;
  players?:      Array<{
    name:       string;
    position:   string;
    ovr?:       number;
    stats?:     Record<string, number>;
    traits?:    string[];
  }>;
}

export async function getNextOpponentData(
  userId: string
): Promise<{ success: boolean; data?: OpponentData; error?: string }> {
  try {
    // 1. Get user's team
    const { data: myTeam, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !myTeam) return { success: false, error: 'Team not found.' };

    // 2. Get scout level
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('scout_level')
      .eq('team_id', myTeam.id)
      .maybeSingle();

    const scoutLevel: number = infra?.scout_level ?? 1;

    // 3. Find next pending match
    const { data: match } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id')
      .eq('status', 'pending')
      .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!match) return { success: false, error: 'No upcoming match found.' };

    const opponentTeamId = match.home_team_id === myTeam.id
      ? match.away_team_id
      : match.home_team_id;

    // 4. Get opponent team name
    const { data: oppTeam } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('id', opponentTeamId)
      .single();

    if (!oppTeam) return { success: false, error: 'Opponent team not found.' };

    // 5. Get opponent players
    const { data: oppPlayers } = await supabaseAdmin
      .from('players')
      .select('name, position, ovr, stats, traits')
      .eq('team_id', opponentTeamId)
      .order('ovr', { ascending: false });

    const players = oppPlayers ?? [];
    const avgOvr  = players.length
      ? Math.round(players.reduce((s, p) => s + (p.ovr || 0), 0) / players.length)
      : 0;

    // 6. Apply Fog of War based on scout level
    let fogLevel: FogOfWarLevel;
    let visiblePlayers: OpponentData['players'];

    if (scoutLevel <= 2) {
      // Fog: only OVR visible
      fogLevel       = 'hidden';
      visiblePlayers = undefined;
    } else if (scoutLevel <= 4) {
      // Partial: names + position, no stats/traits
      fogLevel       = 'partial';
      visiblePlayers = players.map(p => ({
        name:     p.name,
        position: p.position,
      }));
    } else {
      // Full: everything visible
      fogLevel       = 'full';
      visiblePlayers = players.map(p => ({
        name:     p.name,
        position: p.position,
        ovr:      p.ovr,
        stats:    p.stats,
        traits:   p.traits,
      }));
    }

    return {
      success: true,
      data: {
        team_id:     oppTeam.id,
        team_name:   oppTeam.name,
        avg_ovr:     avgOvr,
        fog_level:   fogLevel,
        scout_level: scoutLevel,
        players:     visiblePlayers,
      },
    };

  } catch (err: any) {
    console.error('[getNextOpponentData] Error:', err);
    return { success: false, error: err.message ?? 'Failed to fetch opponent data.' };
  }
}
