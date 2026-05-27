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
      .select("id, name, user_id");

    if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

    if (!teams || teams.length < 2) {
      return NextResponse.json({ message: "Not enough teams to simulate a match round" }, { status: 200 });
    }

    // 3. Pair teams up (Simple sequential pairing for MVP)
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
      // Fetch starting players
      const [homePlayersRes, awayPlayersRes] = await Promise.all([
        supabase.from("players").select("*").eq("team_id", match.homeTeam.id).eq("lineup_status", "starting"),
        supabase.from("players").select("*").eq("team_id", match.awayTeam.id).eq("lineup_status", "starting")
      ]);

      const homePlayers = homePlayersRes.data || [];
      const awayPlayers = awayPlayersRes.data || [];

      // Calculate Attack & Defense
      const calculatePower = (players: any[]) => {
        let attack = 0;
        let defense = 0;
        players.forEach(p => {
          let modifier = p.stamina < 50 ? 0.8 : 1.0; // 20% penalty if stamina < 50
          if (p.position === 'FWD') {
            attack += ((p.stats?.shooting || 0) + (p.stats?.pace || 0)) * modifier;
          } else if (p.position === 'MID') {
            attack += (p.stats?.passing || 0) * modifier;
            defense += ((p.stats?.passing || 0) * 0.5) * modifier;
          } else if (p.position === 'DEF') {
            defense += ((p.stats?.defending || 0) + (p.stats?.physical || 0)) * modifier;
          } else if (p.position === 'GK') {
            defense += ((p.stats?.defending || p.ovr) || 0) * modifier;
          }
        });
        return { attack, defense };
      };

      const homePower = calculatePower(homePlayers);
      const awayPower = calculatePower(awayPlayers);

      // Score logic based on difference + RNG
      const calcGoals = (atk: number, def: number) => {
        const diff = atk - def;
        const luck = (Math.random() * 0.3) - 0.15; // +/- 15%
        const adjustedDiff = diff * (1 + luck);
        if (adjustedDiff > 100) return 3 + Math.floor(Math.random() * 3);
        if (adjustedDiff > 50) return 2 + Math.floor(Math.random() * 2);
        if (adjustedDiff > 10) return 1 + Math.floor(Math.random() * 2);
        if (adjustedDiff > -20 && Math.random() > 0.5) return 1;
        return 0;
      };

      const homeScore = calcGoals(homePower.attack, awayPower.defense);
      const awayScore = calcGoals(awayPower.attack, homePower.defense);

      // 6. Insert match result
      const { error: matchInsertError } = await supabase
        .from("league_matches")
        .insert({
          home_team_id: match.homeTeam.id,
          away_team_id: match.awayTeam.id,
          home_score: homeScore,
          away_score: awayScore,
          status: 'completed',
          is_played: true,
          events: [],
        });

      if (matchInsertError) throw new Error(`Failed to insert match: ${matchInsertError.message}`);

      // 7. Calculate league points & Distribute Rewards
      let homePoints = 0, awayPoints = 0;
      let homeWins = 0, homeDraws = 0, homeLosses = 0;
      let awayWins = 0, awayDraws = 0, awayLosses = 0;

      const grantReward = async (team: any, resultType: 'win' | 'draw' | 'loss') => {
        const { data: infra } = await supabase.from('infrastructure').select('stadium_level').eq('team_id', team.id).maybeSingle();
        const level = infra ? infra.stadium_level : 1;
        
        let reward = 0;
        if (resultType === 'win') {
          reward = 500 + (level * 100);
        } else if (resultType === 'draw') {
          reward = 150 + (level * 30);
        } else {
          reward = 50 + (level * 10);
        }
        
        await supabase.rpc('increment_fancoins', { u_id: team.user_id, amount: reward });
      };

      if (homeScore > awayScore) {
        homePoints = 3; homeWins = 1; awayLosses = 1;
        await grantReward(match.homeTeam, 'win');
        await grantReward(match.awayTeam, 'loss');
      } else if (awayScore > homeScore) {
        awayPoints = 3; awayWins = 1; homeLosses = 1;
        await grantReward(match.awayTeam, 'win');
        await grantReward(match.homeTeam, 'loss');
      } else {
        homePoints = 1; awayPoints = 1; homeDraws = 1; awayDraws = 1;
        await grantReward(match.homeTeam, 'draw');
        await grantReward(match.awayTeam, 'draw');
      }

      // Helper to update standings
      const updateStanding = async (teamId: string, points: number, wins: number, draws: number, losses: number) => {
        const { data: current } = await supabase.from("league_standings").select("*").eq("team_id", teamId).maybeSingle();
        if (current) {
          await supabase.from("league_standings").update({
            matches_played: current.matches_played + 1,
            wins: current.wins + wins, draws: current.draws + draws, losses: current.losses + losses, points: current.points + points,
          }).eq("team_id", teamId);
        } else {
          await supabase.from("league_standings").insert({
            team_id: teamId, matches_played: 1, wins, draws, losses, points,
          });
        }
      };

      await updateStanding(match.homeTeam.id, homePoints, homeWins, homeDraws, homeLosses);
      await updateStanding(match.awayTeam.id, awayPoints, awayWins, awayDraws, awayLosses);

      // Stamina Depletion
      const deductStamina = async (players: any[]) => {
        for (const p of players) {
           const drop = Math.floor(Math.random() * 11) + 15; // 15 to 25
           const newStamina = Math.max(0, p.stamina - drop);
           await supabase.from('players').update({ stamina: newStamina }).eq('id', p.id);
        }
      };

      await deductStamina(homePlayers);
      await deductStamina(awayPlayers);

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
