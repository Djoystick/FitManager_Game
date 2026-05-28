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

    // ШАГ Е: Award FanCoins based on match result + Stadium level
    // Formula (from migration 00030):
    //   Win  = 500 + stadium_level × 75
    //   Draw = 250 + stadium_level × 35
    //   Loss = 100 + stadium_level × 15
    const awardMatchFc = async (teamId: string, gf: number, ga: number) => {
      const matchResult = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
      const { data: infra } = await supabaseAdmin
        .from('infrastructure')
        .select('stadium_level')
        .eq('team_id', teamId)
        .maybeSingle();
      const stadiumLevel = infra?.stadium_level ?? 1;

      let baseReward = 0;
      let levelBonus = 0;
      if (matchResult === 'win') { baseReward = 500; levelBonus = 75; }
      else if (matchResult === 'draw') { baseReward = 250; levelBonus = 35; }
      else { baseReward = 100; levelBonus = 15; }
      
      const totalReward = baseReward + (stadiumLevel * levelBonus);

      const { data: teamData } = await supabaseAdmin
        .from('teams')
        .select('user_id')
        .eq('id', teamId)
        .maybeSingle();
        
      if (!teamData || !teamData.user_id) return;
      
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('balance_fancoins')
        .eq('id', teamData.user_id)
        .maybeSingle();
        
      if (userData) {
        const newBalance = (Number(userData.balance_fancoins) || 0) + totalReward;
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ balance_fancoins: newBalance })
          .eq('id', teamData.user_id);
          
        if (updateError) {
          console.error(`[resolveMatch] Failed to update balance for user ${teamData.user_id}:`, updateError);
        }
      }
    };

    await awardMatchFc(match.home_team_id, result.score.home, result.score.away);
    await awardMatchFc(match.away_team_id, result.score.away, result.score.home);

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
    
    let roundNumber = userMatch ? userMatch.round_number : 999;
    
    if (!userMatch) {
      console.log('[simulateNextPendingMatch] No pending match found, inserting dummy match');
      const { data: randomTeam } = await supabaseAdmin
        .from('teams')
        .select('id, league_id')
        .neq('id', teamData.id)
        .limit(1)
        .single();
        
      if (randomTeam) {
        const { data: newMatch, error: insertError } = await supabaseAdmin
          .from('league_matches')
          .insert({
            home_team_id: teamData.id,
            away_team_id: randomTeam.id,
            league_id: randomTeam.league_id || null,
            round_number: 999,
            status: 'pending',
            is_played: false
          })
          .select('round_number')
          .single();
          
        if (!insertError && newMatch) {
          roundNumber = newMatch.round_number;
        } else {
          return { success: false, error: 'Failed to create dummy match' };
        }
      } else {
        return { success: false, error: 'No opponent teams available for dummy match' };
      }
    }
    
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

export async function getUnseenMatches(teamId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('league_matches')
      .select('id, round_number, home_score, away_score, home_team_id, away_team_id, teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('is_played', true)
      .or(`and(home_team_id.eq.${teamId},home_team_viewed.eq.false),and(away_team_id.eq.${teamId},away_team_viewed.eq.false)`);

    if (error) {
      console.error('[getUnseenMatches] error:', error);
      return { success: false, error: error.message };
    }

    // Format the response
    const formatted = data?.map(m => {
      const isHome = m.home_team_id === teamId;
      const opponentName = isHome ? (m.away_team as any)?.name : (m.teams as any)?.name;
      const gf = isHome ? m.home_score : m.away_score;
      const ga = isHome ? m.away_score : m.home_score;
      const result = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
      
      return {
        id: m.id,
        opponent: opponentName || 'Unknown',
        gf, ga,
        result
      };
    }) || [];

    return { success: true, matches: formatted };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markMatchesAsViewed(matchIds: string[], teamId: string) {
  try {
    if (!matchIds || matchIds.length === 0) return { success: true };

    // Find which are home vs away for this team
    const { data: matches } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id')
      .in('id', matchIds);
      
    if (!matches) return { success: true };

    const homeMatches = matches.filter(m => m.home_team_id === teamId).map(m => m.id);
    const awayMatches = matches.filter(m => m.away_team_id === teamId).map(m => m.id);

    if (homeMatches.length > 0) {
      await supabaseAdmin
        .from('league_matches')
        .update({ home_team_viewed: true })
        .in('id', homeMatches);
    }
    if (awayMatches.length > 0) {
      await supabaseAdmin
        .from('league_matches')
        .update({ away_team_viewed: true })
        .in('id', awayMatches);
    }

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

