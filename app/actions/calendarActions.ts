'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateLeagueSchedule(instanceId?: string) {
  try {
    if (!instanceId) return { success: false, error: 'instanceId is required.' };

    // 1. Get all 14 teams for this instance
    const { data: standings } = await supabaseAdmin
      .from('league_standings')
      .select('team_id')
      .eq('league_instance_id', instanceId);
      
    if (!standings || standings.length !== 14) {
      return { success: false, error: `Must have exactly 14 teams in standings to generate a full schedule. Found: ${standings?.length}` };
    }

    const teamIds = standings.map(s => s.team_id);
    const matchesToInsert = [];

    // Round-robin algorithm for 14 teams
    const numTeams = 14;
    const numRounds = 13;
    const halfSize = numTeams / 2;
    
    const teams = [...teamIds];

    for (let round = 1; round <= numRounds; round++) {
      for (let i = 0; i < halfSize; i++) {
        const home = teams[i];
        const away = teams[numTeams - 1 - i];
        
        let matchHome = home;
        let matchAway = away;

        if (round % 2 === 0 && i === 0) {
          matchHome = away;
          matchAway = home;
        }

        // 1st leg
        matchesToInsert.push({ league_instance_id: instanceId, round_number: round, home_team_id: matchHome, away_team_id: matchAway, is_played: false });
        
        // 2nd leg (reverse fixture, +13 rounds)
        matchesToInsert.push({ league_instance_id: instanceId, round_number: round + 13, home_team_id: matchAway, away_team_id: matchHome, is_played: false });
      }
      
      const firstTeam = teams[0];
      const secondTeam = teams[1];
      teams.splice(1, 1);
      teams.push(secondTeam);
    }

    const { error } = await supabaseAdmin.from('league_matches').insert(matchesToInsert);
    if (error) {
      console.error("League Generation Error:", error);
      throw error;
    }

    return { success: true, message: `Successfully generated ${matchesToInsert.length} matches across 26 rounds for instance ${instanceId}.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error during schedule generation.' };
  }
}

export async function simulateNextRound(userId?: string) {
  try {
    let userTeamId = null;
    if (userId) {
      const { data: ut } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
      if (ut) userTeamId = ut.id;
    }

    // Find lowest round_number where is_played == false
    const { data: unplayedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('is_played', false)
      .order('round_number', { ascending: true })
      .limit(1);

    if (!unplayedMatches || unplayedMatches.length === 0) {
      return { success: false, error: 'No unplayed rounds left in the schedule.' };
    }

    const targetRound = unplayedMatches[0].round_number;

    // Get all matches for this round
    const { data: matches } = await supabaseAdmin
      .from('league_matches')
      .select('*')
      .eq('round_number', targetRound)
      .eq('is_played', false);

    if (!matches || matches.length === 0) return { success: false, error: 'No matches found for the target round.' };

    const updates = [];
    const teamStats: Record<string, { matches: number, wins: number, draws: number, losses: number, gf: number, ga: number, pts: number }> = {};

    // Fetch user IDs and names for fancoins distribution and reports
    const { data: teamsData } = await supabaseAdmin.from('teams').select('id, user_id, name');
    const teamUsers: Record<string, string> = {};
    const teamNames: Record<string, string> = {};
    if (teamsData) {
      teamsData.forEach(t => {
        teamUsers[t.id] = t.user_id;
        teamNames[t.id] = t.name;
      });
    }

    // Fetch infrastructure for stadium level
    const { data: infraData } = await supabaseAdmin.from('infrastructure').select('team_id, stadium_level');
    const teamStadiums: Record<string, number> = {};
    if (infraData) {
      infraData.forEach(i => teamStadiums[i.team_id] = i.stadium_level);
    }

    // Initialize stats
    // ── L1 FIX: Scope standings query to this league instance only ────────────
    // Previously fetched ALL standings without a WHERE clause. This caused:
    //   1. Full-table scan — OOM / timeout as the game scales to 1000+ leagues
    //   2. Stats accumulation across different league instances for teams
    //      that played in multiple historical seasons
    //
    // We resolve the league_instance_id from the first match in the batch.
    const leagueInstanceId = matches[0]?.league_instance_id;

    const { data: currentStandings } = await supabaseAdmin
      .from('league_standings')
      .select('*')
      .eq('league_instance_id', leagueInstanceId);

    if (currentStandings) {
      currentStandings.forEach(s => {
        teamStats[s.team_id] = {
          matches: s.matches_played || 0,
          wins: s.wins || 0,
          draws: s.draws || 0,
          losses: s.losses || 0,
          gf: s.goals_for || 0,
          ga: s.goals_against || 0,
          pts: s.points || 0
        };
      });
    }

    const matchReports = []; // Array to collect reports
    const playerUpdates: Record<string, any> = {}; // Track player state changes

    // Fetch players for all teams in the target round
    const teamIdsInRound = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
    const { data: roundPlayers } = await supabaseAdmin
      .from('players')
      .select('id, team_id, name, position, ovr, lineup_slot, lineup_status, is_injured, stamina')
      .in('team_id', teamIdsInRound)
      .eq('lineup_status', 'starting')
      .eq('is_injured', false);

    const playersByTeam: Record<string, any[]> = {};
    teamIdsInRound.forEach(id => playersByTeam[id] = []);
    if (roundPlayers) {
      roundPlayers.forEach(p => {
        if (playersByTeam[p.team_id]) playersByTeam[p.team_id].push(p);
        
        // Stamina Decay (15 to 25 points)
        const decay = Math.floor(Math.random() * 11) + 15;
        const newStamina = Math.max(0, p.stamina - decay);
        playerUpdates[p.id] = { ...playerUpdates[p.id], stamina: newStamina };
      });
    }

    // Fetch injured players to process natural healing
    const { data: injuredPlayers } = await supabaseAdmin
      .from('players')
      .select('id, injury_matches_left')
      .in('team_id', teamIdsInRound)
      .eq('is_injured', true);

    if (injuredPlayers) {
      injuredPlayers.forEach(p => {
        const newLeft = (p.injury_matches_left || 1) - 1;
        if (newLeft <= 0) {
          playerUpdates[p.id] = { ...playerUpdates[p.id], is_injured: false, injury_matches_left: 0 };
        } else {
          playerUpdates[p.id] = { ...playerUpdates[p.id], injury_matches_left: newLeft };
        }
      });
    }

    for (const match of matches) {
      let homeOvr = playersByTeam[match.home_team_id].reduce((sum, p) => sum + p.ovr, 0) / Math.max(1, playersByTeam[match.home_team_id].length) || 50;
      let awayOvr = playersByTeam[match.away_team_id].reduce((sum, p) => sum + p.ovr, 0) / Math.max(1, playersByTeam[match.away_team_id].length) || 50;

      const events: any[] = [];
      let homeRedCards = 0;
      let awayRedCards = 0;

      // Cards Generation
      if (Math.random() < 0.3) {
        const isHome = Math.random() > 0.5;
        const teamId = isHome ? match.home_team_id : match.away_team_id;
        const teamPlayers = playersByTeam[teamId];
        if (teamPlayers.length > 0) {
          const player = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
          const isRed = Math.random() < (0.05 / 0.30); // 5% overall chance
          events.push({
            type: isRed ? 'red_card' : 'yellow_card',
            player_id: player.id,
            player_name: player.name,
            team_id: teamId,
            minute: Math.floor(Math.random() * 90) + 1
          });
          if (isRed) {
            if (isHome) { homeRedCards++; homeOvr *= 0.9; }
            else { awayRedCards++; awayOvr *= 0.9; }
          }
        }
      }

      // Injuries Generation (10% chance per match)
      if (Math.random() < 0.1) {
        const isHome = Math.random() > 0.5;
        const teamId = isHome ? match.home_team_id : match.away_team_id;
        const teamPlayers = playersByTeam[teamId];
        if (teamPlayers.length > 0) {
          const player = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
          events.push({
            type: 'injury',
            player_id: player.id,
            player_name: player.name,
            team_id: teamId,
            minute: Math.floor(Math.random() * 90) + 1
          });
          const injuryMatches = Math.floor(Math.random() * 3) + 1;
          playerUpdates[player.id] = { ...playerUpdates[player.id], is_injured: true, injury_matches_left: injuryMatches };
        }
      }

      // Score Generation based on OVR difference
      const ovrDiff = homeOvr - awayOvr;
      const baseGoals = 1.5;
      const homeExpected = baseGoals + (ovrDiff * 0.1);
      const awayExpected = baseGoals - (ovrDiff * 0.1);
      
      const homeScore = Math.max(0, Math.floor(homeExpected + (Math.random() * 3 - 1.5)));
      const awayScore = Math.max(0, Math.floor(awayExpected + (Math.random() * 3 - 1.5)));

      // Goals Generation
      const generateGoals = (score: number, teamId: string) => {
        const teamPlayers = playersByTeam[teamId];
        const attackers = teamPlayers.filter(p => ['FWD', 'MID', 'LWF', 'RWF', 'ST', 'CF', 'CAM'].includes(p.position || p.lineup_slot?.split('_')[0]));
        const available = attackers.length > 0 ? attackers : teamPlayers;

        for (let i = 0; i < score; i++) {
          if (available.length > 0) {
            const player = available[Math.floor(Math.random() * available.length)];
            events.push({
              type: 'goal',
              player_id: player.id,
              player_name: player.name,
              team_id: teamId,
              minute: Math.floor(Math.random() * 90) + 1
            });
          }
        }
      };

      generateGoals(homeScore, match.home_team_id);
      generateGoals(awayScore, match.away_team_id);

      // Knockout & Penalty Logic
      let penaltyEvent = null;
      if (match.is_knockout && homeScore === awayScore) {
        const homePen = Math.floor(Math.random() * 2) + 4; // 4 or 5
        const awayPen = homePen === 5 ? Math.floor(Math.random() * 2) + 3 : 5; // e.g. 5:4 or 4:5
        
        penaltyEvent = {
          type: 'penalty_shootout',
          score: `${homePen}:${awayPen}`,
          winner_team_id: homePen > awayPen ? match.home_team_id : match.away_team_id
        };
        events.push(penaltyEvent);
      }

      // Sort events by minute
      events.sort((a, b) => (a.minute || 0) - (b.minute || 0));

      matchReports.push({
        match_id: match.id,
        home_team_id: match.home_team_id,
        home_team_name: teamNames[match.home_team_id] || 'Unknown Home Team',
        away_team_id: match.away_team_id,
        away_team_name: teamNames[match.away_team_id] || 'Unknown Away Team',
        home_score: homeScore,
        away_score: awayScore,
        is_knockout: match.is_knockout,
        events
      });

      // Queue match update
      updates.push(supabaseAdmin.from('league_matches').update({
        home_score: homeScore,
        away_score: awayScore,
        is_played: true,
        match_events: events
      }).eq('id', match.id));

      // Update team stats safely
      if (!teamStats[match.home_team_id]) teamStats[match.home_team_id] = { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0 };
      if (!teamStats[match.away_team_id]) teamStats[match.away_team_id] = { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0 };

      const h = teamStats[match.home_team_id];
      const a = teamStats[match.away_team_id];

      h.matches++;
      a.matches++;
      h.gf += homeScore;
      h.ga += awayScore;
      a.gf += awayScore;
      a.ga += homeScore;

      if (homeScore > awayScore) {
        h.wins++; h.pts += 3;
        a.losses++;
      } else if (homeScore < awayScore) {
        a.wins++; a.pts += 3;
        h.losses++;
      } else {
        h.draws++; h.pts += 1;
        a.draws++; a.pts += 1;
      }

      // Fancoins Economy
      let homeAmount = 50 * (teamStadiums[match.home_team_id] || 1); // home bonus tickets
      let awayAmount = 0;
      if (homeScore > awayScore) {
        homeAmount += 100;
        awayAmount += 10;
      } else if (homeScore < awayScore) {
        awayAmount += 100;
        homeAmount += 10;
      } else {
        homeAmount += 50;
        awayAmount += 50;
      }

      if (teamUsers[match.home_team_id]) {
        updates.push(supabaseAdmin.rpc('increment_fancoins', { u_id: teamUsers[match.home_team_id], amount: homeAmount }));
      }
      if (teamUsers[match.away_team_id]) {
        updates.push(supabaseAdmin.rpc('increment_fancoins', { u_id: teamUsers[match.away_team_id], amount: awayAmount }));
      }
    }
    // Await match and fancoins updates
    await Promise.all(updates);

    // Process all accumulated player updates with explicit error logging
    const playerUpdatePromises = Object.keys(playerUpdates).map(async (playerId) => {
      const payload = playerUpdates[playerId];
      // Safety check for stamina
      if (payload.stamina !== undefined && payload.stamina < 0) {
        payload.stamina = 0;
      }
      
      const { error } = await supabaseAdmin
        .from('players')
        .update(payload)
        .eq('id', playerId);
        
      if (error) {
        console.error(`[MatchEngine] Failed to update player ${playerId}:`, error);
      }
    });

    await Promise.all(playerUpdatePromises);

    // Batch update standings
    // ── L1/L3 FIX: Scope each UPDATE to the correct league_instance_id ────────
    // leagueInstanceId was resolved from matches[0] above (see standings SELECT fix).
    // Without this, a team promoted/relegated into multiple historical instances
    // would have ALL its rows updated simultaneously — corrupting past season data.
    const standingsUpdates = Object.entries(teamStats).map(([teamId, st]) =>
      supabaseAdmin.from('league_standings').update({
        matches_played: st.matches,
        wins:           st.wins,
        draws:          st.draws,
        losses:         st.losses,
        goals_for:      st.gf,
        goals_against:  st.ga,
        points:         st.pts
      })
        .eq('team_id', teamId)
        .eq('league_instance_id', leagueInstanceId)  // L3 FIX: scope to active instance
    );

    await Promise.all(standingsUpdates);

    // Revalidate Next.js cache to ensure UI gets fresh data
    revalidatePath('/lineup');
    revalidatePath('/base');

    return { 
      success: true, 
      message: `Simulated Round ${targetRound} successfully. ${matches.length} matches played.`, 
      matchReports,
      userTeamId,
      userMatchReport: userTeamId ? matchReports.find(r => r.home_team_id === userTeamId || r.away_team_id === userTeamId) : null
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error during simulation.' };
  }
}
