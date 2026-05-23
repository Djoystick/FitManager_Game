import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  // 1. Basic security check: Require Bearer token matching CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name");

    if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

    if (!teams || teams.length < 2) {
      return NextResponse.json({ message: "Not enough teams to simulate a match round" }, { status: 200 });
    }

    // 3. Pair teams up (Simple sequential pairing for MVP)
    // If there's an odd number, the last team rests this round.
    const matches = [];
    for (let i = 0; i < teams.length - 1; i += 2) {
      matches.push({
        homeTeam: teams[i],
        awayTeam: teams[i + 1],
      });
    }

    const results = [];

    // 4. Process each match pair
    for (const match of matches) {
      // Fetch average OVR from players for home team
      const { data: homePlayers, error: homeErr } = await supabase
        .from("players")
        .select("ovr")
        .eq("team_id", match.homeTeam.id);
      
      if (homeErr) throw new Error(`Failed to fetch home players: ${homeErr.message}`);

      // Fetch average OVR from players for away team
      const { data: awayPlayers, error: awayErr } = await supabase
        .from("players")
        .select("ovr")
        .eq("team_id", match.awayTeam.id);
      
      if (awayErr) throw new Error(`Failed to fetch away players: ${awayErr.message}`);

      const calculateOvr = (players: { ovr: number }[] | null) => {
        if (!players || players.length === 0) return 50; // Fallback OVR
        const sum = players.reduce((acc, p) => acc + p.ovr, 0);
        return Math.round(sum / players.length);
      };

      const homeOvr = calculateOvr(homePlayers);
      const awayOvr = calculateOvr(awayPlayers);

      // 5. Run simulation math (from Phase 3)
      const totalOvr = homeOvr + awayOvr;
      const homePossessionProb = homeOvr / totalOvr;
      const goalChance = 0.05;

      let homeScore = 0;
      let awayScore = 0;
      let currentPossession = Math.random() > 0.5 ? match.homeTeam.id : match.awayTeam.id;

      for (let minute = 1; minute <= 90; minute++) {
        if (minute === 45) {
          currentPossession = currentPossession === match.homeTeam.id ? match.awayTeam.id : match.homeTeam.id;
        }

        const randomRoll = Math.random();
        let keepsPossession = false;

        if (currentPossession === match.homeTeam.id) {
          keepsPossession = randomRoll < (homePossessionProb + 0.1);
        } else {
          keepsPossession = randomRoll < ((1.0 - homePossessionProb) + 0.1);
        }

        if (!keepsPossession) {
          currentPossession = currentPossession === match.homeTeam.id ? match.awayTeam.id : match.homeTeam.id;
        }

        if (Math.random() < goalChance) {
          if (Math.random() < 0.3) {
            if (currentPossession === match.homeTeam.id) {
              homeScore++;
              currentPossession = match.awayTeam.id;
            } else {
              awayScore++;
              currentPossession = match.homeTeam.id;
            }
          }
        }
      }

      // 6. Insert match result into the database
      const { error: matchInsertError } = await supabase
        .from("matches")
        .insert({
          home_team_id: match.homeTeam.id,
          away_team_id: match.awayTeam.id,
          home_score: homeScore,
          away_score: awayScore,
          match_date: new Date().toISOString(),
          is_simulated: true,
        });

      if (matchInsertError) throw new Error(`Failed to insert match: ${matchInsertError.message}`);

      // 7. Calculate league points
      let homePoints = 0, awayPoints = 0;
      let homeWins = 0, homeDraws = 0, homeLosses = 0;
      let awayWins = 0, awayDraws = 0, awayLosses = 0;

      if (homeScore > awayScore) {
        homePoints = 3;
        homeWins = 1;
        awayLosses = 1;
      } else if (awayScore > homeScore) {
        awayPoints = 3;
        awayWins = 1;
        homeLosses = 1;
      } else {
        homePoints = 1;
        awayPoints = 1;
        homeDraws = 1;
        awayDraws = 1;
      }

      // Helper to update standings
      const updateStanding = async (
        teamId: string,
        points: number,
        wins: number,
        draws: number,
        losses: number
      ) => {
        const { data: current } = await supabase
          .from("league_standings")
          .select("*")
          .eq("team_id", teamId)
          .single();

        if (current) {
          const { error: updateError } = await supabase
            .from("league_standings")
            .update({
              matches_played: current.matches_played + 1,
              wins: current.wins + wins,
              draws: current.draws + draws,
              losses: current.losses + losses,
              points: current.points + points,
            })
            .eq("team_id", teamId);
          if (updateError) throw new Error(`Failed to update standing: ${updateError.message}`);
        } else {
          const { error: insertError } = await supabase
            .from("league_standings")
            .insert({
              team_id: teamId,
              matches_played: 1,
              wins,
              draws,
              losses,
              points,
            });
          if (insertError) throw new Error(`Failed to insert standing: ${insertError.message}`);
        }
      };

      await updateStanding(match.homeTeam.id, homePoints, homeWins, homeDraws, homeLosses);
      await updateStanding(match.awayTeam.id, awayPoints, awayWins, awayDraws, awayLosses);

      results.push({
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeScore,
        awayScore,
      });
    }

    return NextResponse.json({
      message: "League simulation completed successfully",
      matches: results,
    });
  } catch (error: any) {
    console.error("Cron League Sim Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
