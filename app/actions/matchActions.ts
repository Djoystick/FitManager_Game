'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { MatchReport } from '@/components/MatchReportModal';
import { createClient } from '@supabase/supabase-js';
import { simulateMatch as runMatchEngine, MatchPlayer } from '@/app/utils/matchEngine';

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

export async function markMatchAsViewed(matchId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('league_matches')
      .update({ is_viewed: true })
      .eq('id', matchId);

    if (error) throw error;
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error marking match as viewed:', error);
    return { success: false, error: error.message };
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
      .order('created_at', { ascending: false })
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
      id: match.id,
      home_team_id: match.home_team_id,
      home_team_name: teamNames[match.home_team_id] || 'Unknown Home Team',
      away_team_id: match.away_team_id,
      away_team_name: teamNames[match.away_team_id] || 'Unknown Away Team',
      home_score: match.home_score || 0,
      away_score: match.away_score || 0,
      events: match.events || []
    }));

    return { success: true, data: history };
  } catch (err: any) {
    console.error("Match history error:", err);
    return { success: false, error: err.message || 'Unknown server error.' };
  }
}

export async function resolveMatch(matchId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[resolveMatch] START for matchId: ${matchId}`);
    // ШАГ А: Загрузка данных матча
    const { data: match, error: matchError } = await supabaseAdmin
      .from('league_matches')
      .select('*')
      .eq('id', matchId)
      .single();
    
    if (matchError || !match) {
      console.log(`[resolveMatch] Match not found`);
      return { success: false, error: 'Match not found' };
    }
    if (match.status === 'completed' || match.is_played) {
      console.log(`[resolveMatch] Match already completed`);
      return { success: false, error: 'Match already completed' };
    }

    // Загрузка всех игроков обеих команд
    const { data: homePlayersData, error: hpError } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('team_id', match.home_team_id);
    
    const { data: awayPlayersData, error: apError } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('team_id', match.away_team_id);

    if (hpError || apError || !homePlayersData || !awayPlayersData) {
      console.log(`[resolveMatch] Failed to load players`);
      return { success: false, error: 'Failed to load players' };
    }

    // Вспомогательная функция для выделения стартового состава
    const getStarters = (players: any[]) => {
      let starters = players.filter(p => p.lineup_slot !== null && parseInt(p.lineup_slot) <= 10);
      if (starters.length < 11) {
        console.warn(`[resolveMatch] Lineup incomplete (${starters.length}). Using Iron GK OVR fallback.`);
        const gks = players.filter(p => p.position === 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        const fields = players.filter(p => p.position !== 'GK').sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        
        if (gks.length > 0) {
          starters = [gks[0], ...fields.slice(0, 10)];
        } else {
          starters = fields.slice(0, 11);
        }
      }
      return starters;
    };

    const homePlayers = getStarters(homePlayersData);
    const awayPlayers = getStarters(awayPlayersData);

    let isTechnicalForfeit = false;
    let forfeitHomeScore = 0;
    let forfeitAwayScore = 0;

    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      console.warn(`[resolveMatch] Technical Forfeit. Home: ${homePlayers.length}, Away: ${awayPlayers.length}`);
      isTechnicalForfeit = true;
      if (homePlayers.length < 11 && awayPlayers.length >= 11) { forfeitHomeScore = 0; forfeitAwayScore = 3; }
      else if (awayPlayers.length < 11 && homePlayers.length >= 11) { forfeitHomeScore = 3; forfeitAwayScore = 0; }
      else { forfeitHomeScore = 0; forfeitAwayScore = 0; } // Both forfeit
    } else {
      console.log(`[resolveMatch] Lineups loaded successfully (11 vs 11).`);
    }

    // Загрузка сыгранности (Chemistry)
    const { data: homeChem } = await supabaseAdmin.from('player_chemistry').select('*').eq('team_id', match.home_team_id);
    const { data: awayChem } = await supabaseAdmin.from('player_chemistry').select('*').eq('team_id', match.away_team_id);

    // Рассчитываем кто имеет зеленую связь
    const getGreenLinks = (chemRecords: any[]) => {
      const greenMap: Record<string, boolean> = {};
      if (!chemRecords) return greenMap;
      
      chemRecords.forEach(c => {
         const score = (c.matches_together || 0) + ((c.sweat_points || 0) * 5);
         if (score >= 70) { 
            greenMap[c.player_1_id] = true;
            greenMap[c.player_2_id] = true;
         }
      });
      return greenMap;
    };
    const homeGreen = getGreenLinks(homeChem || []);
    const awayGreen = getGreenLinks(awayChem || []);

    // ШАГ Б: Прогон через Ядро
    const mapToMatchPlayer = (p: any): MatchPlayer => ({
      id: p.id,
      name: p.name,
      position: p.lineup_slot?.split('_')[0] || p.position,
      stats: p.stats,
      stamina: p.stamina,
      traits: p.traits || []
    });

    const homeLineup = homePlayers.map(mapToMatchPlayer);
    const awayLineup = awayPlayers.map(mapToMatchPlayer);

    let result;
    if (isTechnicalForfeit) {
      console.log(`[resolveMatch] Bypassing Core Match Engine due to technical forfeit.`);
      result = {
        score: { home: forfeitHomeScore, away: forfeitAwayScore },
        events: [{ minute: 1, type: 'info', description: 'Match awarded by technical forfeit due to incomplete squad.' }],
        staminaDrain: { home: {}, away: {} }
      };
    } else {
      console.log(`[resolveMatch] Running Core Match Engine...`);
      result = runMatchEngine(homeLineup, awayLineup, homeGreen, awayGreen);
    }
    console.log(`[resolveMatch] Core Engine output score: ${result.score.home}-${result.score.away}`);

    // ШАГ В: Обновление матча
    const { error: updateMatchError } = await supabaseAdmin
      .from('league_matches')
      .update({
        home_score: result.score.home,
        away_score: result.score.away,
        status: 'completed',
        is_played: true, // for backwards compatibility
        is_viewed: false,
        events: result.events,
        stamina_drain: result.staminaDrain
      })
      .eq('id', matchId);

    if (updateMatchError) {
      console.error(`[resolveMatch] CRITICAL DB ERROR (league_matches):`, updateMatchError);
      throw new Error(`DB Write Failed: ${updateMatchError.message} (Details: ${updateMatchError.details})`);
    }

    // ШАГ Г: Обновление стамины
    const updateStamina = async (drainMap: Record<string, number>) => {
      const promises = Object.entries(drainMap).map(async ([pId, newStam]) => {
        const { error } = await supabaseAdmin.from('players').update({ stamina: Math.max(0, newStam) }).eq('id', pId);
        if (error) {
          console.error(`[resolveMatch] CRITICAL DB ERROR (players stamina):`, error);
          throw new Error(`DB Write Failed for stamina: ${error.message}`);
        }
      });
      await Promise.all(promises);
    };
    await updateStamina(result.staminaDrain.home);
    await updateStamina(result.staminaDrain.away);

    // ШАГ Д: Обновление Standings
    const updateStandings = async (teamId: string, gf: number, ga: number) => {
      const { data: st, error: stError } = await supabaseAdmin.from('league_standings').select('*').eq('team_id', teamId).single();
      if (stError || !st) {
        console.warn(`[resolveMatch] Could not find standings for team ${teamId}, skipping.`);
        return;
      }
      
      let wins = st.wins || 0;
      let draws = st.draws || 0;
      let losses = st.losses || 0;
      let points = st.points || 0;

      if (gf > ga) { wins++; points += 3; }
      else if (gf === ga) { draws++; points += 1; }
      else { losses++; }

      const { error: updateStError } = await supabaseAdmin.from('league_standings').update({
        matches_played: (st.matches_played || 0) + 1,
        wins, draws, losses, points,
        goals_for: (st.goals_for || 0) + gf,
        goals_against: (st.goals_against || 0) + ga
      }).eq('team_id', teamId);
      
      if (updateStError) {
        console.error(`[resolveMatch] CRITICAL DB ERROR (league_standings):`, updateStError);
        throw new Error(`DB Write Failed for standings: ${updateStError.message}`);
      }
    };

    await updateStandings(match.home_team_id, result.score.home, result.score.away);
    await updateStandings(match.away_team_id, result.score.away, result.score.home);

    console.log(`[resolveMatch] SUCCESS for matchId: ${matchId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[resolveMatch] Exception:', error);
    return { success: false, error: error.message || 'Unknown exception in resolveMatch' };
  }
}

export async function getUnviewedMatch(userId: string) {
  try {
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamError || !teamData) return { success: false, error: 'Team not found' };

    const { data: match, error: matchError } = await supabaseAdmin
      .from('league_matches')
      .select('*, home_team:teams!league_matches_home_team_id_fkey(name), away_team:teams!league_matches_away_team_id_fkey(name)')
      .eq('status', 'completed')
      .eq('is_viewed', false)
      .or(`home_team_id.eq.${teamData.id},away_team_id.eq.${teamData.id}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (matchError) return { success: false, error: 'Database error' };
    if (!match) return { success: true, data: null };

    const report = {
      id: match.id,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      home_team_name: match.home_team.name,
      away_team_name: match.away_team.name,
      home_score: match.home_score,
      away_score: match.away_score,
      events: match.events || [],
      stamina_drain: match.stamina_drain || { home: {}, away: {} }
    };

    return { success: true, data: report, userTeamId: teamData.id };
  } catch (error: any) {
    console.error('getUnviewedMatch error:', error);
    return { success: false, error: error.message };
  }
}

export async function simulateNextPendingMatch(userId: string) {
  try {
    console.log('[simulateNextPendingMatch] START for user:', userId);
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamError || !teamData) {
      console.log('[simulateNextPendingMatch] Team not found');
      return { success: false, error: 'Team not found' };
    }

    console.log('[simulateNextPendingMatch] Team ID:', teamData.id);

    const { data: userMatch, error: matchError } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('status', 'pending')
      .or(`home_team_id.eq.${teamData.id},away_team_id.eq.${teamData.id}`)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (matchError) {
      console.error('[simulateNextPendingMatch] Error finding match:', matchError);
      return { success: false, error: matchError.message };
    }
    
    if (!userMatch) {
      console.log('[simulateNextPendingMatch] No pending match found');
      return { success: false, error: 'No pending matches found for this team' };
    }

    const roundNumber = userMatch.round_number;
    console.log(`[simulateNextPendingMatch] Simulating entire round: ${roundNumber}`);

    // Fetch all pending matches for this round
    const { data: roundMatches, error: roundError } = await supabaseAdmin
      .from('league_matches')
      .select('id')
      .eq('status', 'pending')
      .eq('round_number', roundNumber);

    if (roundError || !roundMatches) {
      return { success: false, error: 'Failed to fetch round matches' };
    }

    console.log(`[simulateNextPendingMatch] Found ${roundMatches.length} matches to simulate.`);

    // Simulate each match sequentially (could use Promise.all, but sequential is safer for DB locks)
    for (const rm of roundMatches) {
      await resolveMatch(rm.id);
    }
    
    revalidatePath('/', 'page');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error('[simulateNextPendingMatch] Exception:', error);
    return { success: false, error: error.message || 'Unknown exception' };
  }
}
