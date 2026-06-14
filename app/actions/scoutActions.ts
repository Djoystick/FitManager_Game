'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

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
  fog_level: 'hidden' | 'partial' | 'full';
  team_ovr_estimated: number;
}

export async function getUpcomingOpponentScoutReport(): Promise<{ success: boolean; data?: ScoutReport; error?: string }> {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'User not authenticated' };

    // 0. Get user's team ID
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (teamError || !teamData) {
      return { success: false, error: 'Failed to find user team.' };
    }
    const userTeamId = teamData.id;

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

    // 3.5. Calculate Team OVR (average of top 11)
    const sortedOvr = players.map(p => p.ovr || 50).sort((a, b) => b - a);
    const top11 = sortedOvr.slice(0, 11);
    const avgOvr = top11.length > 0 ? Math.round(top11.reduce((a, b) => a + b, 0) / top11.length) : 50;

    // Fetch Scout Level
    const { data: infraData } = await supabaseAdmin
      .from('infrastructure')
      .select('scout_level')
      .eq('team_id', userTeamId)
      .maybeSingle();
    const scoutLevel = infraData?.scout_level || 1;

    let fogLevel: 'hidden' | 'partial' | 'full' = 'hidden';
    if (scoutLevel >= 5) {
      fogLevel = 'full';
    } else if (scoutLevel >= 3) {
      fogLevel = 'partial';
    }

    // 4. Fog of War Masking
    let maskedPlayers: ScoutedPlayer[] = [];
    if (fogLevel !== 'hidden') {
      maskedPlayers = players.map(p => ({
        id: p.id,
        name: fogLevel === 'partial' ? p.name : p.name,
        position: p.position,
        age: p.age,
        traits: fogLevel === 'partial' ? [] : (p.traits || []),
        ovr_estimated: fogLevel === 'full' ? (p.ovr || 50) : Math.round((p.ovr || 50) / 5) * 5
      }));
    }

    return {
      success: true,
      data: {
        opponent_team_id: opponentTeamId,
        opponent_team_name: opponentTeamName || 'Unknown Team',
        match_id: match.id,
        round_number: match.round_number,
        players: maskedPlayers,
        fog_level: fogLevel,
        team_ovr_estimated: avgOvr
      }
    };
  } catch (err: any) {
    console.error('[ScoutActions] Exception:', err);
    return { success: false, error: err.message || 'Unknown server error' };
  }
}

export async function getOpponentScoutReportByTeamId(userTeamId: string, opponentTeamId: string): Promise<{ success: boolean; data?: ScoutReport; error?: string }> {
  try {
    const { data: teamData } = await supabaseAdmin.from('teams').select('scouting_facility_level').eq('id', userTeamId).single();
    const scoutLevel = teamData?.scouting_facility_level || 1;

    const { data: opponentTeam } = await supabaseAdmin.from('teams').select('name').eq('id', opponentTeamId).single();
    
    const { data: players } = await supabaseAdmin.from('players').select('*').eq('team_id', opponentTeamId).order('ovr', { ascending: false }).limit(15);
    
    if (!players) return { success: false, error: 'No players found' };

    let fogLevel: 'hidden' | 'partial' | 'full' = 'hidden';
    if (scoutLevel >= 5) fogLevel = 'full';
    else if (scoutLevel >= 3) fogLevel = 'partial';

    let maskedPlayers: ScoutedPlayer[] = [];
    if (fogLevel !== 'hidden') {
      maskedPlayers = players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        age: p.age,
        traits: fogLevel === 'partial' ? [] : (p.traits || []),
        ovr_estimated: fogLevel === 'full' ? (p.ovr || 50) : Math.round((p.ovr || 50) / 5) * 5
      }));
    }

    const healthy = players.filter(p => !p.is_injured).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const starters = healthy.slice(0, 11);
    const avgOvr = starters.length > 0 ? Math.round(starters.reduce((acc, p) => acc + (p.ovr || 50), 0) / starters.length) : 0;

    return {
      success: true,
      data: {
        opponent_team_id: opponentTeamId,
        opponent_team_name: opponentTeam?.name || 'Unknown Team',
        match_id: 'any',
        round_number: 0,
        players: maskedPlayers,
        fog_level: fogLevel,
        team_ovr_estimated: avgOvr
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
