'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateLeagueSchedule() {
  try {
    // 1. Get all 14 teams
    const { data: standings } = await supabaseAdmin.from('league_standings').select('team_id');
    if (!standings || standings.length !== 14) {
      return { success: false, error: 'Must have exactly 14 teams in standings to generate a full schedule.' };
    }

    const teamIds = standings.map(s => s.team_id);
    const matchesToInsert = [];

    // Round-robin algorithm for 14 teams
    // Fix first team, rotate the other 13.
    const numTeams = 14;
    const numRounds = 13;
    const halfSize = numTeams / 2;
    
    // Copy array
    let teams = [...teamIds];

    for (let round = 1; round <= numRounds; round++) {
      for (let i = 0; i < halfSize; i++) {
        const home = teams[i];
        const away = teams[numTeams - 1 - i];
        
        // Alternate home/away based on round to balance slightly
        if (round % 2 === 0 && i === 0) {
          matchesToInsert.push({ round_number: round, home_team_id: away, away_team_id: home, is_played: false });
        } else {
          matchesToInsert.push({ round_number: round, home_team_id: home, away_team_id: away, is_played: false });
        }
      }
      
      // Rotate array: element at index 1 goes to end, rest shifts down, index 0 is fixed
      const firstTeam = teams[0];
      const secondTeam = teams[1];
      teams.splice(1, 1);
      teams.push(secondTeam);
    }

    // Clear existing matches (using a dummy condition that matches all UUIDs, or simply delete all)
    await supabaseAdmin.from('league_matches').delete().neq('round_number', -1);

    const { error } = await supabaseAdmin.from('league_matches').insert(matchesToInsert);
    if (error) {
      console.error("League Generation Error:", error);
      throw error;
    }

    return { success: true, message: `Successfully generated ${matchesToInsert.length} matches across ${numRounds} rounds.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error during schedule generation.' };
  }
}

export async function simulateNextRound() {
  try {
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

    // Fetch user IDs for fancoins distribution
    const { data: teamsData } = await supabaseAdmin.from('teams').select('id, user_id');
    const teamUsers: Record<string, string> = {};
    if (teamsData) {
      teamsData.forEach(t => teamUsers[t.id] = t.user_id);
    }

    // Fetch infrastructure for stadium level
    const { data: infraData } = await supabaseAdmin.from('infrastructure').select('team_id, stadium_level');
    const teamStadiums: Record<string, number> = {};
    if (infraData) {
      infraData.forEach(i => teamStadiums[i.team_id] = i.stadium_level);
    }

    // Initialize stats
    const { data: currentStandings } = await supabaseAdmin.from('league_standings').select('*');
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

    for (const match of matches) {
      // Basic math simulation for fast-forward
      const homeScore = Math.floor(Math.random() * 5);
      const awayScore = Math.floor(Math.random() * 5);
      
      // Queue match update
      updates.push(supabaseAdmin.from('league_matches').update({
        home_score: homeScore,
        away_score: awayScore,
        is_played: true
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

      // INJURY MECHANIC: 50% chance per match to injure a random starting player (temporary for testing)
      if (Math.random() < 0.50) {
        // Pick a team randomly
        const injuredTeamId = Math.random() < 0.5 ? match.home_team_id : match.away_team_id;
        // Query a random player from that team who is currently a starter and not already injured
        const { data: teamPlayers } = await supabaseAdmin
          .from('players')
          .select('id')
          .eq('team_id', injuredTeamId)
          .eq('lineup_status', 'starting') // Ensure they are a starter
          .eq('is_injured', false)
          .limit(15);
        
        if (teamPlayers && teamPlayers.length > 0) {
          const randomPlayer = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
          console.log("INJURY TRIGGERED FOR PLAYER:", randomPlayer.id, "TEAM:", injuredTeamId);
          updates.push(supabaseAdmin.from('players').update({ is_injured: true }).eq('id', randomPlayer.id));
        }
      }
    }

    // Await all match and injury updates
    await Promise.all(updates);

    // Batch update standings
    const standingsUpdates = Object.entries(teamStats).map(([teamId, st]) => 
      supabaseAdmin.from('league_standings').update({
        matches_played: st.matches,
        wins: st.wins,
        draws: st.draws,
        losses: st.losses,
        goals_for: st.gf,
        goals_against: st.ga,
        points: st.pts
      }).eq('team_id', teamId)
    );

    await Promise.all(standingsUpdates);

    return { success: true, message: `Simulated Round ${targetRound} successfully. ${matches.length} matches played.` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error during simulation.' };
  }
}
