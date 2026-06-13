'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { MatchReport } from '@/components/MatchReportModal';
import { createClient } from '@supabase/supabase-js';
import { simulateMatch as runMatchEngine, MatchPlayer } from '@/app/utils/matchEngine';
import { triggerMatchAchievements } from '@/app/services/achievementService';

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
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data: match } = await supabaseAdmin.from('league_matches').select('home_team_id, away_team_id').eq('id', matchId).single();
    if (!match) return { success: false, error: 'Match not found' };

    if (match.home_team_id !== team.id && match.away_team_id !== team.id) {
      return { success: false, error: 'Forbidden: You do not own this match' };
    }

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

export async function getMatchHistory(): Promise<{ success: boolean; data?: MatchReport[]; error?: string }> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

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
      events: match.events || [],
      home_tactic: match.home_tactic || 'Balanced',
      away_tactic: match.away_tactic || 'Balanced'
    }));

    return { success: true, data: history };
  } catch (err: any) {
    console.error("Match history error:", err);
    return { success: false, error: err.message || 'Unknown server error.' };
  }
}

export async function getMatchSchedule(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

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
      .eq('is_played', false)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('round_number', { ascending: true });

    if (matchesError) {
      console.error("Error fetching match schedule:", matchesError);
      return { success: false, error: 'Failed to fetch match schedule.' };
    }

    if (!matches || matches.length === 0) {
      return { success: true, data: [] };
    }

    const teamIds = new Set<string>();
    matches.forEach(m => {
      teamIds.add(m.home_team_id);
      teamIds.add(m.away_team_id);
    });

    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', Array.from(teamIds));

    const teamNames: Record<string, string> = {};
    if (teamsData) {
      teamsData.forEach(t => {
        teamNames[t.id] = t.name;
      });
    }

    const schedule = matches.map(match => ({
      id: match.id,
      home_team_id: match.home_team_id,
      home_team_name: teamNames[match.home_team_id] || 'Unknown Home Team',
      away_team_id: match.away_team_id,
      away_team_name: teamNames[match.away_team_id] || 'Unknown Away Team',
      round_number: match.round_number
    }));

    return { success: true, data: schedule };
  } catch (err: any) {
    console.error("Match schedule error:", err);
    return { success: false, error: err.message || 'Unknown server error.' };
  }
}

export async function resolveMatch(
  matchId: string,
  isCupMatch: boolean = false,
  deferredTeamIds: Set<string> = new Set()
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[resolveMatch] START for matchId: ${matchId} isCupMatch: ${isCupMatch}`);

    // Auto-detect cup match if not explicitly passed
    if (!isCupMatch) {
      const { data: cupMatch } = await supabaseAdmin
        .from('tournament_matches')
        .select('id')
        .eq('id', matchId)
        .maybeSingle();
      if (cupMatch) isCupMatch = true;
    }
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

    // Вспомогательная функция для выделения стартового состава и скамейки
    // ── R7 FIX: Filter out injured players from starters AND bench ──────────
    // Previously, injured players could appear in the starting lineup, meaning
    // the technical forfeit check was never triggered even if the whole squad
    // was injured. This caused bots to play with 0-OVR injured players.
    const getSquad = (players: any[]) => {
      let starters = players.filter(
        p => p.lineup_slot !== null && parseInt(p.lineup_slot) <= 10 && !p.is_injured
      );
      let bench = players.filter(
        p => (p.lineup_status === 'bench' || p.lineup_status === 'reserve') && !p.is_injured
      );

      const healthyCount = starters.length;

      if (starters.length < 11) {
        // ── R7: Log when the squad is critically depleted due to injuries ────
        const injuredCount = players.filter(p => p.is_injured).length;
        if (injuredCount > 0) {
          console.warn(
            `[resolveMatch] Squad depleted by injuries: ${injuredCount} injured, only ${healthyCount} healthy starters available. Using best-available fallback.`
          );
        } else {
          console.warn(`[resolveMatch] Lineup incomplete (${starters.length}). Using fallback.`);
        }

        // Fallback: best healthy players by OVR (including bench)
        const allHealthy = players.filter(p => !p.is_injured).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        const gks    = allHealthy.filter(p => p.position === 'GK');
        const fields = allHealthy.filter(p => p.position !== 'GK');

        if (gks.length > 0) {
          starters = [gks[0], ...fields.slice(0, 10)];
        } else {
          starters = allHealthy.slice(0, 11);
        }
        bench = []; // Disable bench on fallback to avoid duplicate player references
      }

      return { starters, bench: bench.slice(0, 7) }; // Max 7 subs
    };

    const homeSquad = getSquad(homePlayersData);
    const awaySquad = getSquad(awayPlayersData);
    
    const homePlayers = homeSquad.starters;
    const awayPlayers = awaySquad.starters;

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

    // Загрузка тактик обеих команд
    const { data: homeTeamData } = await supabaseAdmin.from('teams').select('tactic').eq('id', match.home_team_id).single();
    const { data: awayTeamData } = await supabaseAdmin.from('teams').select('tactic').eq('id', match.away_team_id).single();
    const homeTactic = homeTeamData?.tactic || 'Balanced';
    const awayTactic = awayTeamData?.tactic || 'Balanced';

    // [P1 FIX] Green Links only activate if BOTH players are in the active lineup
    const getGreenLinks = (chemRecords: any[], lineupIds: Set<string>) => {
      const greenMap: Record<string, boolean> = {};
      if (!chemRecords) return greenMap;
      
      chemRecords.forEach(c => {
         const score = (c.matches_together || 0) + ((c.sweat_points || 0) * 5);
         if (score >= 70 && lineupIds.has(c.player_1_id) && lineupIds.has(c.player_2_id)) { 
            greenMap[c.player_1_id] = true;
            greenMap[c.player_2_id] = true;
         }
      });
      return greenMap;
    };
    const homeLineupIds = new Set(homePlayers.map((p: any) => p.id as string));
    const awayLineupIds = new Set(awayPlayers.map((p: any) => p.id as string));
    const homeGreen = getGreenLinks(homeChem || [], homeLineupIds);
    const awayGreen = getGreenLinks(awayChem || [], awayLineupIds);

    // ШАГ Б: Прогон через Ядро
    // [P0 FIX] safeStats ensures NaN/null values from DB don't silently break the engine
    const safeStats = (raw: any) => ({
      pace:      Math.max(1, Math.min(99, Number(raw?.pace      ?? 50) || 50)),
      shooting:  Math.max(1, Math.min(99, Number(raw?.shooting  ?? 50) || 50)),
      passing:   Math.max(1, Math.min(99, Number(raw?.passing   ?? 50) || 50)),
      dribbling: Math.max(1, Math.min(99, Number(raw?.dribbling ?? 50) || 50)),
      defending: Math.max(1, Math.min(99, Number(raw?.defending ?? 50) || 50)),
      physical:  Math.max(1, Math.min(99, Number(raw?.physical  ?? 50) || 50)),
    });

    const mapToMatchPlayer = (p: any): MatchPlayer => {
      let resolvedPos = p.position ?? 'MID';
      if (p.lineup_slot && isNaN(Number(p.lineup_slot))) {
        resolvedPos = p.lineup_slot.split('_')[0];
      }
      return {
        id: p.id,
        name: p.name ?? 'Unknown',
        position: resolvedPos,
        stats: safeStats(p.stats),
        stamina: Math.max(0, Math.min(100, Number(p.stamina ?? 70) || 70)),
        traits: Array.isArray(p.traits) ? p.traits : [],
        morale: Number(p.morale ?? 70) || 70
      };
    };

    const homeLineup = homePlayers.map(mapToMatchPlayer);
    const awayLineup = awayPlayers.map(mapToMatchPlayer);
    const homeBench = homeSquad.bench.map(mapToMatchPlayer);
    const awayBench = awaySquad.bench.map(mapToMatchPlayer);

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
      result = runMatchEngine(homeLineup, awayLineup, homeBench, awayBench, homeGreen, awayGreen, homeTactic, awayTactic, [], [], isCupMatch);
    }
    console.log(`[resolveMatch] Core Engine output score: ${result.score.home}-${result.score.away}`);

    // ШАГ В: Обновление матча
    const updateData: any = {
      home_score: result.score.home,
      away_score: result.score.away,
      status: 'completed',
      is_played: true,
      is_viewed: false,
      events: result.events,
      stamina_drain: result.staminaDrain,
      home_tactic: homeTactic,
      away_tactic: awayTactic,
    };

    // Store penalty shootout results for cup matches
    if (result.penalties) {
      updateData.penalty_home = result.penalties.home;
      updateData.penalty_away = result.penalties.away;
    }

    const { error: updateMatchError } = await supabaseAdmin
      .from(isCupMatch ? 'tournament_matches' : 'league_matches')
      .update(updateData)
      .eq('id', matchId)
      .eq('status', 'pending');

    if (updateMatchError) {
      console.error(`[resolveMatch] CRITICAL DB ERROR (league_matches):`, updateMatchError);
      throw new Error(`DB Write Failed: ${updateMatchError.message} (Details: ${updateMatchError.details})`);
    }

    // ШАГ Г: Обновление стамины и морали
    const updatePlayerCondition = async (
      playersData: any[],
      drainMap: Record<string, number>,
      isWinner: boolean,
      isDraw: boolean
    ) => {
      const promises = playersData.map(async p => {
        let updateData: any = {};
        
        if (drainMap[p.id] !== undefined) {
          updateData.stamina = Math.max(0, drainMap[p.id]);
        }
        
        let moraleChange = 0;
        if (isWinner) moraleChange += 5;
        else if (!isDraw) moraleChange -= 5;
        
        const isStarter = p.lineup_slot !== null && parseInt(p.lineup_slot) <= 10;
        const isBench = p.lineup_status === 'bench' || p.lineup_status === 'reserve';
        
        if (isWinner && isStarter) moraleChange += 2;
        if (!isWinner && isBench) moraleChange -= 3;
        if (isWinner && isBench) moraleChange -= 1;
        
        if (moraleChange !== 0) {
          updateData.morale = Math.max(0, Math.min(100, (p.morale ?? 70) + moraleChange));
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error } = await supabaseAdmin.from('players').update(updateData).eq('id', p.id);
          if (error) {
            console.error(`[resolveMatch] CRITICAL DB ERROR (players condition):`, error);
            throw new Error(`DB Write Failed for player condition: ${error.message}`);
          }
        }
      });
      await Promise.all(promises);
    };

    const isHomeWin = result.score.home > result.score.away;
    const isAwayWin = result.score.away > result.score.home;
    const isDrawMatch = result.score.home === result.score.away;

    await updatePlayerCondition(homePlayersData, result.staminaDrain.home, isHomeWin, isDrawMatch);
    await updatePlayerCondition(awayPlayersData, result.staminaDrain.away, isAwayWin, isDrawMatch);

    // ШАГ Д: Обновление Standings (league matches only)
    if (!isCupMatch) {
    const updateStandings = async (teamId: string, instanceId: string, gf: number, ga: number) => {
      const { data: st, error: stError } = await supabaseAdmin
        .from('league_standings')
        .select('*')
        .eq('team_id', teamId)
        .eq('league_instance_id', instanceId)  // L3 FIX: scope to correct instance
        .maybeSingle();

      if (stError || !st) {
        console.warn(`[resolveMatch] Could not find standings for team ${teamId} in instance ${instanceId}, skipping.`);
        return;
      }

      let wins   = st.wins   || 0;
      let draws  = st.draws  || 0;
      let losses = st.losses || 0;
      let points = st.points || 0;

      if (gf > ga)      { wins++;  points += 3; }
      else if (gf === ga) { draws++; points += 1; }
      else              { losses++; }

      const { error: updateStError } = await supabaseAdmin
        .from('league_standings')
        .update({
          matches_played: (st.matches_played || 0) + 1,
          wins, draws, losses, points,
          goals_for:     (st.goals_for     || 0) + gf,
          goals_against: (st.goals_against || 0) + ga
        })
        .eq('team_id', teamId)
        .eq('league_instance_id', instanceId);  // L3 FIX: scope update too

      if (updateStError) {
        console.error(`[resolveMatch] CRITICAL DB ERROR (league_standings):`, updateStError);
        throw new Error(`DB Write Failed for standings: ${updateStError.message}`);
      }
    };

    await updateStandings(match.home_team_id, match.league_instance_id, result.score.home, result.score.away);
    await updateStandings(match.away_team_id, match.league_instance_id, result.score.away, result.score.home);
    } // end !isCupMatch

    // ── ШАГ Е: FC Transaction (Salary + Match Reward) — атомарная операция ────
    // ── R6 FIX: Replaced separate deductSquadSalary() + awardMatchFc() calls ─
    // The old pattern was: read balance → compute salary → write; then read
    // balance again → compute reward → write. A concurrent process could read
    // the same balance value between those two writes, causing one update to
    // silently overwrite the other (classic read-modify-write race condition).
    //
    // The new pattern calls a single atomic SQL function that computes
    //   new_balance = GREATEST(0, balance - salary + reward)
    // in one statement, making it race-condition-proof by design.
    //
    // Salary formula: FLOOR(MAX(0, ovr-40)^1.3 × 0.8) + MAX(0, age-28)
    // Reward formula: (base + stadiumLevel × bonus) × prestige_multiplier
    //   Win  = (500 + lvl×150) × mult  |  Draw = (250 + lvl×70) × mult
    //   Loss = (100 + lvl×30)  × mult

    const calcPlayerSalary = (ovr: number, age: number): number => {
      const ovrPart = Math.floor(Math.pow(Math.max(0, ovr - 40), 1.3) * 0.8);
      const agePart = Math.max(0, (age ?? 25) - 28);
      return ovrPart + agePart;
    };

    const applyFcTransaction = async (teamId: string, players: any[], gf: number, ga: number) => {
      // Resolve user
      const { data: teamData } = await supabaseAdmin
        .from('teams').select('user_id').eq('id', teamId).maybeSingle();
      if (!teamData?.user_id) return;
      const userId = teamData.user_id;

      // Calculate salary
      const totalSalary = players.reduce((sum, p) =>
        sum + calcPlayerSalary(Number(p.ovr ?? 55), Number(p.age ?? 25)), 0);

      // ── Fetch infrastructure (stadium_level, seating_level, ticket price) ───
      const { data: infra } = await supabaseAdmin
        .from('infrastructure')
        .select('stadium_level, seating_level, ticket_price_league')
        .eq('team_id', teamId)
        .maybeSingle();

      const stadiumLevel  = infra?.stadium_level  ?? 1;
      const seatingLevel  = infra?.seating_level  ?? 1;
      const ticketPrice   = infra?.ticket_price_league ?? 20;

      // ── Match result FC reward (base + stadium bonus) ─────────────────────
      const matchResult = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
      const baseReward  = matchResult === 'win'  ? 500 : matchResult === 'draw' ? 250 : 100;
      const levelBonus  = matchResult === 'win'  ? 150 : matchResult === 'draw' ? 70  : 30;
      const rawReward   = baseReward + stadiumLevel * levelBonus;

      const { data: userData } = await supabaseAdmin
        .from('users').select('prestige_multiplier').eq('id', userId).maybeSingle();
      const multiplier  = Number(userData?.prestige_multiplier ?? 1.0);
      const matchReward = Math.floor(rawReward * multiplier);

      // ── Ticket Revenue (E1: logarithmic diminishing returns) ────────────────
      // Diminishing returns: L1→L2 is a big jump, L9→L10 is tiny.
      // Formula: LOG_TICKET_BASE × ln(stadiumLevel + 1) × (1 + seatingLevel × 0.05)
      const LOG_TICKET_BASE = 1800;
      let ticketRevenue = Math.floor(
        LOG_TICKET_BASE * Math.log(stadiumLevel + 1) * (1 + seatingLevel * 0.05)
      );

      // ── E2: Deferred Maintenance Penalty — 20% ticket revenue reduction ────
      if (deferredTeamIds.has(teamId)) {
        ticketRevenue = Math.floor(ticketRevenue * 0.80);
        console.log(`[resolveMatch] Deferred maintenance penalty applied to ${teamId}: -20% tickets`);
      }

      // ── Services passive income: services_level × 30 FC ──────────────────
      const servicesLevel   = (infra as any)?.services_level ?? 1;
      const servicesRevenue = servicesLevel * 30;

      const totalReward = matchReward + ticketRevenue + servicesRevenue;

      console.log(
        `[resolveMatch] FC tx team ${teamId}: ` +
        `-${totalSalary} salary | +${matchReward} match (${matchResult}) | ` +
        `+${ticketRevenue} tickets | +${servicesRevenue} services`
      );

      // ── R6: Single atomic RPC — no race condition possible ─────────────────
      const { error: rpcError } = await supabaseAdmin.rpc('update_fancoins_after_match', {
        p_user_id: userId,
        p_salary:  totalSalary,
        p_reward:  totalReward
      });

      if (rpcError) {
        console.error(`[resolveMatch] CRITICAL: FC transaction RPC failed for team ${teamId}:`, rpcError);
        // Do NOT fallback to non-atomic read-modify-write — that causes race conditions.
        // The RPC failure will be retried or investigated manually.
      }

      // Apply bankruptcy stamina penalty if balance hit zero
      const { data: afterUpdate } = await supabaseAdmin
        .from('users').select('balance_fancoins').eq('id', userId).maybeSingle();
      if ((afterUpdate?.balance_fancoins ?? 1) === 0 && totalSalary > totalReward) {
        console.warn(`[resolveMatch] Team ${teamId} went bankrupt. Applying stamina penalty.`);
        await Promise.all(
          players.map(p =>
            supabaseAdmin.from('players')
              .update({ stamina: Math.min(Number(p.stamina ?? 30), 30) })
              .eq('id', p.id)
          )
        );
      }
    };

    // Cup matches use different reward logic (handled in cup section below)
    if (!isCupMatch) {
      await applyFcTransaction(match.home_team_id, homePlayersData, result.score.home, result.score.away);
      await applyFcTransaction(match.away_team_id, awayPlayersData, result.score.away, result.score.home);
    }

    // ── ШАГ Ж: Ачивки (Achievements) ──────────────────────────────────────────
    await triggerMatchAchievements(match.home_team_id, result.score.home > result.score.away, result.score.home, result.score.away);
    await triggerMatchAchievements(match.away_team_id, result.score.away > result.score.home, result.score.away, result.score.home);

    // ── ШАГ Ж.1.5: Обновление соперничества (Rivalries) ───────────────────────
    try {
      const { data: homeTeamOwner } = await supabaseAdmin.from('teams').select('user_id').eq('id', match.home_team_id).maybeSingle();
      const { data: awayTeamOwner } = await supabaseAdmin.from('teams').select('user_id').eq('id', match.away_team_id).maybeSingle();

      if (homeTeamOwner?.user_id && awayTeamOwner?.user_id) {
        const userA = homeTeamOwner.user_id < awayTeamOwner.user_id ? homeTeamOwner.user_id : awayTeamOwner.user_id;
        const userB = homeTeamOwner.user_id < awayTeamOwner.user_id ? awayTeamOwner.user_id : homeTeamOwner.user_id;
        const isHomeWinner = result.score.home > result.score.away;
        const isAwayWinner = result.score.away > result.score.home;
        const isDraw = result.score.home === result.score.away;

        // Upsert rivalry
        const { data: existingRivalry } = await supabaseAdmin
          .from('manager_rivalries')
          .select('*')
          .eq('user_a_id', userA)
          .eq('user_b_id', userB)
          .maybeSingle();

        if (existingRivalry) {
          const newMatchesPlayed = existingRivalry.matches_played + 1;
          const updateData: any = {
            matches_played: newMatchesPlayed,
            updated_at: new Date().toISOString(),
          };

          if (isDraw) {
            updateData.draws = existingRivalry.draws + 1;
          } else if (isHomeWinner) {
            // Determine if home team is user_a or user_b
            if (homeTeamOwner.user_id === userA) {
              updateData.user_a_wins = existingRivalry.user_a_wins + 1;
            } else {
              updateData.user_b_wins = existingRivalry.user_b_wins + 1;
            }
          } else {
            if (awayTeamOwner.user_id === userA) {
              updateData.user_a_wins = existingRivalry.user_a_wins + 1;
            } else {
              updateData.user_b_wins = existingRivalry.user_b_wins + 1;
            }
          }

          // Mark as derby if 3+ matches played
          if (newMatchesPlayed >= 3) {
            updateData.is_derby = true;
          }

          await supabaseAdmin
            .from('manager_rivalries')
            .update(updateData)
            .eq('id', existingRivalry.id);

          // Derby bonus: +500 FC to winner, +15 morale to all players
          if (newMatchesPlayed >= 3) {
            const winnerTeamId = isHomeWinner ? match.home_team_id : match.away_team_id;
            const loserTeamId = isHomeWinner ? match.away_team_id : match.home_team_id;

            // Winner gets +500 FC
            const { data: winnerTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', winnerTeamId).maybeSingle();
            if (winnerTeam?.user_id) {
              await supabaseAdmin.rpc('update_fancoins_after_match', {
                p_user_id: winnerTeam.user_id,
                p_salary: 0,
                p_reward: 500
              });
            }

            // Winner gets +15 morale to all players
            const { data: winnerPlayers } = await supabaseAdmin.from('players').select('id, morale').eq('team_id', winnerTeamId);
            if (winnerPlayers) {
              await Promise.all(winnerPlayers.map(p =>
                supabaseAdmin.from('players')
                  .update({ morale: Math.min(100, (p.morale ?? 70) + 15) })
                  .eq('id', p.id)
              ));
            }

            // Loser gets -15 morale
            const { data: loserPlayers } = await supabaseAdmin.from('players').select('id, morale').eq('team_id', loserTeamId);
            if (loserPlayers) {
              await Promise.all(loserPlayers.map(p =>
                supabaseAdmin.from('players')
                  .update({ morale: Math.max(0, (p.morale ?? 70) - 15) })
                  .eq('id', p.id)
              ));
            }
          }
        } else {
          // Create new rivalry
          await supabaseAdmin.from('manager_rivalries').insert({
            user_a_id: userA,
            user_b_id: userB,
            matches_played: 1,
            user_a_wins: (!isDraw && userA === (isHomeWinner ? homeTeamOwner.user_id : awayTeamOwner.user_id)) ? 1 : 0,
            user_b_wins: (!isDraw && userB === (isHomeWinner ? homeTeamOwner.user_id : awayTeamOwner.user_id)) ? 1 : 0,
            draws: isDraw ? 1 : 0,
          });
        }
      }
    } catch (rivalryError) {
      console.error('[resolveMatch] Rivalry update failed:', rivalryError);
    }

    // ── ШАГ Ж.2: Кубок — награды и продвижение ────────────────────────────────
    if (isCupMatch) {
      const homeWon = result.score.home > result.score.away ||
                      (result.penalties && result.penalties.home > result.penalties.away);
      const awayWon = result.score.away > result.score.home ||
                      (result.penalties && result.penalties.away > result.penalties.home);
      const winnerTeamId = homeWon ? match.home_team_id : match.away_team_id;
      const loserTeamId  = homeWon ? match.away_team_id : match.home_team_id;

      // Determine if this is the final
      const { data: cupMatch } = await supabaseAdmin
        .from('tournament_matches')
        .select('round')
        .eq('id', matchId)
        .single();

      const isFinal = cupMatch?.round === 'final';

      // Award FC to winner
      const { data: winnerTeam } = await supabaseAdmin
        .from('teams').select('user_id').eq('id', winnerTeamId).maybeSingle();
      if (winnerTeam?.user_id) {
        const winnerReward = isFinal ? 5000 : 2000;
        await supabaseAdmin.rpc('update_fancoins_after_match', {
          p_user_id: winnerTeam.user_id,
          p_salary: 0,
          p_reward: winnerReward
        });
      }

      // Advance winner to next round (if not the final)
      if (!isFinal && winnerTeamId && loserTeamId) {
        const roundOrder = ['round_of_16', 'quarter_final', 'semi_final', 'final'];
        const currentRoundIdx = roundOrder.indexOf(cupMatch?.round ?? 'round_of_16');
        const nextRound = roundOrder[currentRoundIdx + 1];

        if (nextRound) {
          // Find the next match slot in the next round that needs a team
          const { data: nextMatch } = await supabaseAdmin
            .from('tournament_matches')
            .select('id, team_home, team_away')
            .eq('tournament_id', match.tournament_id)
            .eq('round', nextRound)
            .is('team_home', null)
            .order('match_order', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (nextMatch) {
            // Fill the first empty slot
            const updateField = nextMatch.team_home === null ? 'team_home' : 'team_away';
            await supabaseAdmin
              .from('tournament_matches')
              .update({ [updateField]: winnerTeamId })
              .eq('id', nextMatch.id);
          } else {
            // No empty slot found — create a new match in the next round
            const { count: matchCount } = await supabaseAdmin
              .from('tournament_matches')
              .select('*', { count: 'exact', head: true })
              .eq('tournament_id', match.tournament_id)
              .eq('round', nextRound);

            await supabaseAdmin.from('tournament_matches').insert({
              tournament_id: match.tournament_id,
              round: nextRound,
              match_order: (matchCount ?? 0),
              team_home: winnerTeamId,
              status: 'pending'
            });
          }
        }
      }

      // Mark loser as eliminated
      await supabaseAdmin
        .from('tournament_participants')
        .update({ status: 'eliminated' })
        .eq('tournament_id', match.tournament_id)
        .eq('team_id', loserTeamId);

      // If this is the final, mark tournament as completed and award trophies
      if (isFinal) {
        await supabaseAdmin
          .from('tournaments')
          .update({ status: 'completed' })
          .eq('id', match.tournament_id);

        // Award trophy to winner
        const { data: winnerTeamOwner } = await supabaseAdmin.from('teams').select('user_id').eq('id', winnerTeamId).maybeSingle();
        if (winnerTeamOwner?.user_id) {
          await supabaseAdmin.from('trophy_cabinet').insert({
            user_id: winnerTeamOwner.user_id,
            type: 'CUP_GOLD',
            description: 'Cup Tournament Winner',
          });
        }

        // Award trophy to finalist (loser)
        const { data: loserTeamOwner } = await supabaseAdmin.from('teams').select('user_id').eq('id', loserTeamId).maybeSingle();
        if (loserTeamOwner?.user_id) {
          await supabaseAdmin.from('trophy_cabinet').insert({
            user_id: loserTeamOwner.user_id,
            type: 'CUP_SILVER',
            description: 'Cup Tournament Finalist',
          });
        }
      }
    }

    // ── ШАГ Ж.1: Квесты (Quests) ──────────────────────────────────────────────
    try {
      const { data: homeTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', match.home_team_id).maybeSingle();
      const { data: awayTeam } = await supabaseAdmin.from('teams').select('user_id').eq('id', match.away_team_id).maybeSingle();
      
      if (homeTeam?.user_id) {
        await supabaseAdmin.rpc('increment_quest_progress', { p_user_id: homeTeam.user_id, p_type: 'play_match', p_amount: 1 });
      }
      if (awayTeam?.user_id) {
        await supabaseAdmin.rpc('increment_quest_progress', { p_user_id: awayTeam.user_id, p_type: 'play_match', p_amount: 1 });
      }
    } catch (e) {
      console.error('[resolveMatch] Failed to increment play_match quest:', e);
    }

    // ── ШАГ И: Достижения по победам (каждая 10-я победа) ───────────────────────
    try {
      const checkWinAchievement = async (teamId: string, isWinner: boolean) => {
        if (!isWinner) return;
        const { data: team } = await supabaseAdmin.from('teams').select('user_id').eq('id', teamId).maybeSingle();
        if (!team?.user_id) return;

        const { data: standings } = await supabaseAdmin
          .from('league_standings')
          .select('wins')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (standings?.wins && standings.wins > 0 && standings.wins % 10 === 0) {
          // Award 1000 FC
          const { data: userData } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', team.user_id).maybeSingle();
          await supabaseAdmin
            .from('users')
            .update({ balance_fancoins: (userData?.balance_fancoins ?? 0) + 1000 })
            .eq('id', team.user_id);

          // Add trophy
          await supabaseAdmin.from('trophy_cabinet').insert({
            user_id: team.user_id,
            type: 'ACHIEVEMENT',
            description: `${standings.wins} wins milestone`,
          });
        }
      };

      await checkWinAchievement(match.home_team_id, isHomeWin);
      await checkWinAchievement(match.away_team_id, isAwayWin);
    } catch (achError) {
      console.error('[resolveMatch] Win achievement check failed:', achError);
    }

    // ── ШАГ З: Уведомления о травмах ─────────────────────────────────────────
    const injuryEvents = result.events.filter((e: any) => e.type === 'injury' && 'team' in e && 'player_name' in e);
    for (const inj of injuryEvents) {
      const injEvent = inj as { team: 'home' | 'away'; player_name: string };
      const injTeamId = injEvent.team === 'home' ? match.home_team_id : match.away_team_id;
      const { data: injTeamOwner } = await supabaseAdmin
        .from('teams').select('user_id').eq('id', injTeamId).maybeSingle();
      if (injTeamOwner?.user_id) {
        await supabaseAdmin.from('personal_notifications').insert({
          user_id: injTeamOwner.user_id,
          type: 'injury',
          title: 'Player injury',
          message: JSON.stringify({
            en: `${injEvent.player_name} was injured in a match.`,
            ru: `${injEvent.player_name} получил травму в матче.`,
          }),
        });
      }
    }

    console.log(`[resolveMatch] SUCCESS for matchId: ${matchId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[resolveMatch] Exception:', error);
    return { success: false, error: error.message || 'Unknown exception in resolveMatch' };
  }
}

export async function getUnviewedMatch() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

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
      home_tactic: match.home_tactic || 'Balanced',
      away_tactic: match.away_tactic || 'Balanced',
      stamina_drain: match.stamina_drain || { home: {}, away: {} }
    };

    return { success: true, data: report, userTeamId: teamData.id };
  } catch (error: any) {
    console.error('getUnviewedMatch error:', error);
    return { success: false, error: error.message };
  }
}

export async function simulateNextPendingMatch(deferredTeamIds: string[] = []) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const deferredSet = new Set(deferredTeamIds);

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

    // ── R4 FIX: Removed dummy match creation (round: 999 exploit) ────────────
    // Previously, when no pending match existed the code would INSERT a fake
    // match against a random team from any league. This allowed:
    //   1. Unlimited free-FC farming via the UI (win reward with no cooldown)
    //   2. Standings corruption of unrelated league instances
    //   3. Orphan round-999 rows that blocked end-of-season from finalising
    // Now we simply return a clear message and wait for the cron to advance
    // the league to the next round.
    if (!userMatch) {
      console.log('[simulateNextPendingMatch] No pending matches found for team — waiting for cron.');
      return {
        success: false,
        error: 'No pending matches found for your team. The next round will be processed automatically by the league scheduler.'
      };
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

    // Simulate each match sequentially (safer for DB consistency than Promise.all)
    for (const rm of roundMatches) {
      await resolveMatch(rm.id, false, deferredSet);
    }

    revalidatePath('/', 'page');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error('[simulateNextPendingMatch] Exception:', error);
    return { success: false, error: error.message || 'Unknown exception' };
  }
}

export async function getUnseenMatches() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: teamData } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).maybeSingle();
    if (!teamData) return { success: false, error: 'Team not found' };
    const teamId = teamData.id;

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

export async function markMatchesAsViewed(matchIds: string[]) {
  try {
    if (!matchIds || matchIds.length === 0) return { success: true };

    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: teamData } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).maybeSingle();
    if (!teamData) return { success: false, error: 'Team not found' };
    const teamId = teamData.id;

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

