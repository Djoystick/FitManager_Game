'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ScoutedPlayer {
  id: string;
  name: string;
  position: string;
  age: number;
  traits: string[];
  ovr_estimated: number;
}

export interface ScoutReport {
  opponent_team_id: string;
  opponent_team_name: string;
  match_id: string;
  round_number: number;
  players: ScoutedPlayer[];
}

export async function getUpcomingOpponentScoutReport(userTeamId: string): Promise<{ success: boolean; data?: ScoutReport; error?: string }> {
  try {
    // 1. Find the next pending match for the user's team
    const { data: match, error: matchError } = await supabaseAdmin
      .from('league_matches')
      .select(`
        id, 
        home_team_id, 
        away_team_id, 
        round_number,
        home_team:teams!league_matches_home_team_id_fkey(name),
        away_team:teams!league_matches_away_team_id_fkey(name)
      `)
      .eq('status', 'pending')
      .or(`home_team_id.eq.${userTeamId},away_team_id.eq.${userTeamId}`)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (matchError) {
      console.error('[ScoutActions] DB Error finding match:', matchError);
      return { success: false, error: 'Database error while searching for next match.' };
    }

    if (!match) {
      return { success: false, error: 'No upcoming matches found.' };
    }

    // 2. Determine opponent
    const isHome = match.home_team_id === userTeamId;
    const opponentTeamId = isHome ? match.away_team_id : match.home_team_id;
    const opponentTeamName = isHome ? (match.away_team as any)?.name : (match.home_team as any)?.name;

    // 3. Fetch opponent players
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, name, position, age, traits, ovr')
      .eq('team_id', opponentTeamId);

    if (playersError || !players) {
      console.error('[ScoutActions] Error fetching players:', playersError);
      return { success: false, error: 'Failed to load opponent players.' };
    }

    // 4. Fog of War Masking (Round OVR to nearest 5)
    const maskedPlayers: ScoutedPlayer[] = players.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      age: p.age,
      traits: p.traits || [],
      ovr_estimated: Math.round((p.ovr || 50) / 5) * 5
    }));

    return {
      success: true,
      data: {
        opponent_team_id: opponentTeamId,
        opponent_team_name: opponentTeamName || 'Unknown Team',
        match_id: match.id,
        round_number: match.round_number,
        players: maskedPlayers
      }
    };
  } catch (err: any) {
    console.error('[ScoutActions] Exception:', err);
    return { success: false, error: err.message || 'Unknown server error' };
  }
}
