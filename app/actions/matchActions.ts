'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { MatchReport } from '@/components/MatchReportModal';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface MatchResult {
  success: boolean;
  homeScore?: number;
  awayScore?: number;
  staminaDrained?: number;
  homePower?: number;
  awayPower?: number;
  error?: string;
}

export async function simulateMatch(): Promise<MatchResult> {
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

    // 2. Fetch starting lineup players
    const { data: startingPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, ovr, stamina, position, lineup_slot')
      .eq('team_id', teamId)
      .eq('lineup_status', 'starting');

    if (playersError) {
      return { success: false, error: 'Failed to retrieve lineup data.' };
    }

    if (!startingPlayers || startingPlayers.length !== 11) {
      return { success: false, error: `Invalid lineup. You need exactly 11 starting players. Currently: ${startingPlayers?.length || 0}` };
    }

    // 3. Calculate Home OVR with OOP Penalty
    const isCompatible = (natural: string, slot: string) => {
      if (!slot) return true;
      if (natural === slot) return true;
      if (['LWF', 'RWF', 'ST', 'CF'].includes(natural) && slot === 'FWD') return true;
      if (['CAM', 'CDM', 'CM', 'RM', 'LM'].includes(natural) && slot === 'MID') return true;
      if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(natural) && slot === 'DEF') return true;
      return false;
    };

    const totalOvr = startingPlayers.reduce((acc, p) => {
      const slotPos = p.lineup_slot ? p.lineup_slot.split('_')[0] : p.position;
      const oop = !isCompatible(p.position, slotPos);
      return acc + (oop ? Math.floor(p.ovr * 0.8) : p.ovr);
    }, 0);
    // Ensure min 1 OVR to prevent div by 0 issues logically
    const homeOvr = Math.max(1, Math.round(totalOvr / 11)); 

    // 4. Generate Bot Opponent (OVR between 70 and 90)
    const awayOvr = Math.floor(Math.random() * 21) + 70;

    // 5. Simulate Match Logic
    // Luck factor between 0.85 and 1.15
    const homeLuck = 0.85 + Math.random() * 0.3;
    const awayLuck = 0.85 + Math.random() * 0.3;

    const homeFinalPower = homeOvr * homeLuck;
    const awayFinalPower = awayOvr * awayLuck;

    let homeScore = Math.floor(Math.random() * 2);
    let awayScore = Math.floor(Math.random() * 2);

    if (homeFinalPower > awayFinalPower * 1.05) {
      homeScore += 1 + Math.floor(Math.random() * 2);
    } else if (awayFinalPower > homeFinalPower * 1.05) {
      awayScore += 1 + Math.floor(Math.random() * 2);
    }

    if (homeFinalPower > awayFinalPower * 1.20) {
      homeScore += 1 + Math.floor(Math.random() * 2);
    } else if (awayFinalPower > homeFinalPower * 1.20) {
      awayScore += 1 + Math.floor(Math.random() * 2);
    }

    // 6. Stamina Drain (15-20 points per player)
    const drainAmount = 15 + Math.floor(Math.random() * 6);
    
    // Process stamina updates
    for (const player of startingPlayers) {
      const newStamina = Math.max(0, player.stamina - drainAmount);
      await supabase
        .from('players')
        .update({ stamina: newStamina })
        .eq('id', player.id);
    }

    // 7. Upsert League Standings
    // Get current standings
    const { data: standingsData } = await supabase
      .from('league_standings')
      .select('*')
      .eq('team_id', teamId)
      .single();

    let points = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    if (standingsData) {
      points = standingsData.points;
      wins = standingsData.wins;
      draws = standingsData.draws;
      losses = standingsData.losses;
    }

    if (homeScore > awayScore) {
      wins += 1;
      points += 3;
    } else if (homeScore === awayScore) {
      draws += 1;
      points += 1;
    } else {
      losses += 1;
    }

    const { error: standingsError } = await supabase
      .from('league_standings')
      .upsert({
        team_id: teamId,
        matches_played: (standingsData?.matches_played || 0) + 1,
        wins,
        draws,
        losses,
        points
      }, { onConflict: 'team_id' });

    if (standingsError) {
      console.error("League Standings Update Error:", standingsError);
    }

    revalidatePath('/league');
    revalidatePath('/squad');

    return {
      success: true,
      homeScore,
      awayScore,
      staminaDrained: drainAmount,
      homePower: Math.round(homeFinalPower),
      awayPower: Math.round(awayFinalPower)
    };

  } catch (error: any) {
    console.error('Match simulation error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during simulation.' };
  }
}

export async function getMatchHistory(userId: string): Promise<{ success: boolean; data?: MatchReport[]; error?: string }> {
  try {
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamError || !teamData) {
      return { success: false, error: 'Team not found for user.' };
    }

    const teamId = teamData.id;

    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('league_matches')
      .select('*')
      .eq('is_played', true)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('round_number', { ascending: false })
      .limit(10);

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      return { success: false, error: 'Failed to fetch match history.' };
    }

    if (!matches || matches.length === 0) {
      return { success: true, data: [] };
    }

    const teamIds = new Set<string>();
    matches.forEach(m => {
      teamIds.add(m.home_team_id);
      teamIds.add(m.away_team_id);
    });

    const { data: teamsData, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', Array.from(teamIds));

    const teamNames: Record<string, string> = {};
    if (teamsData) {
      teamsData.forEach(t => {
        teamNames[t.id] = t.name;
      });
    }

    const history: MatchReport[] = matches.map(match => ({
      match_id: match.id,
      home_team_id: match.home_team_id,
      home_team_name: teamNames[match.home_team_id] || 'Unknown Home Team',
      away_team_id: match.away_team_id,
      away_team_name: teamNames[match.away_team_id] || 'Unknown Away Team',
      home_score: match.home_score || 0,
      away_score: match.away_score || 0,
      is_knockout: match.is_knockout || false,
      events: match.match_events || []
    }));

    return { success: true, data: history };
  } catch (err: any) {
    console.error("Match history error:", err);
    return { success: false, error: err.message || 'Unknown server error.' };
  }
}
