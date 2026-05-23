import { NextResponse } from "next/server";

export interface MatchRequest {
  homeTeam: {
    id: string;
    name: string;
    ovr: number;
    players?: string[]; // Optional roster for scorer attribution
  };
  awayTeam: {
    id: string;
    name: string;
    ovr: number;
    players?: string[];
  };
}

export interface MatchEvent {
  minute: number;
  type: "COMMENTARY" | "GOAL" | "HALF_TIME" | "FULL_TIME";
  text: string;
  teamId?: string;
  scorer?: string;
}

export interface MatchResponse {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
}

export async function POST(req: Request) {
  try {
    const body: MatchRequest = await req.json();

    const homeOvr = body.homeTeam.ovr || 50;
    const awayOvr = body.awayTeam.ovr || 50;

    const totalOvr = homeOvr + awayOvr;
    const homePossessionProb = homeOvr / totalOvr;
    const goalChance = 0.05;

    let homeScore = 0;
    let awayScore = 0;
    const events: MatchEvent[] = [];

    // Coin toss for starting possession
    let currentPossession = Math.random() > 0.5 ? body.homeTeam.id : body.awayTeam.id;

    events.push({
      minute: 0,
      type: "COMMENTARY",
      text: "Match has started!",
    });

    for (let minute = 1; minute <= 90; minute++) {
      if (minute === 45) {
        events.push({
          minute: 45,
          type: "HALF_TIME",
          text: "Half-time. Teams head to the dressing rooms.",
        });
        // Switch possession at half time
        currentPossession = currentPossession === body.homeTeam.id ? body.awayTeam.id : body.homeTeam.id;
      }

      // Possession logic
      const randomRoll = Math.random();
      let keepsPossession = false;

      if (currentPossession === body.homeTeam.id) {
        // Momentum/Home advantage modifier (+0.1)
        keepsPossession = randomRoll < (homePossessionProb + 0.1);
      } else {
        keepsPossession = randomRoll < ((1.0 - homePossessionProb) + 0.1);
      }

      if (!keepsPossession) {
        currentPossession = currentPossession === body.homeTeam.id ? body.awayTeam.id : body.homeTeam.id;
      }

      // Scoring logic
      if (Math.random() < goalChance) {
        events.push({
          minute,
          type: "COMMENTARY",
          text: "Dangerous attack!",
        });

        // 30% conversion rate
        if (Math.random() < 0.3) {
          const isHome = currentPossession === body.homeTeam.id;
          const scoringTeam = isHome ? body.homeTeam : body.awayTeam;
          
          let scorer = "Player";
          if (scoringTeam.players && scoringTeam.players.length > 0) {
            scorer = scoringTeam.players[Math.floor(Math.random() * scoringTeam.players.length)];
          }

          if (isHome) {
            homeScore++;
          } else {
            awayScore++;
          }

          events.push({
            minute,
            type: "GOAL",
            text: `GOAL!!! ${scorer} scores for ${scoringTeam.name}!`,
            teamId: scoringTeam.id,
            scorer,
          });

          // Possession flips after goal
          currentPossession = isHome ? body.awayTeam.id : body.homeTeam.id;
        } else {
          events.push({
            minute,
            type: "COMMENTARY",
            text: "Missed the target!",
          });
        }
      }
    }

    events.push({
      minute: 90,
      type: "FULL_TIME",
      text: "Full-time! The referee blows the final whistle.",
    });

    const response: MatchResponse = {
      homeScore,
      awayScore,
      events,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
