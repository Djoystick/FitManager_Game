# Phase 3: Match Simulation API

## Overview
We have successfully ported the legacy Kotlin `MatchEngine` simulation logic into a modern, stateless Next.js Serverless API route using strict TypeScript. This lays the foundation for computing match outcomes dynamically within the TMA backend.

## Legacy Mathematical Model
Analysis of `_legacy_source/domain/src/main/kotlin/com/geminiproject/fm/domain/engine/MatchEngine.kt` revealed a minute-by-minute probabilistic simulation engine driven by Overall Rating (OVR) comparisons and RNG dynamics:
1. **OVR Processing**: Both teams' Overall Ratings dictate a normalized probability coefficient (`homePossessionProb = homeAvgRating / totalRating`).
2. **Possession Dynamics**: Every minute, a RNG roll determines if possession is retained. Teams with higher OVR have higher likelihoods, padded with a `+0.1` inertia modifier to mimic team momentum and home advantage mechanics.
3. **Scoring Mechanics**: 
   - While in possession, a team has a flat `5%` chance (`goalChance = 0.05`) of generating a dangerous goal attempt.
   - Once an attempt is triggered, there is a `30%` conversion rate into a successful goal (`Random.nextDouble() < 0.3`).
   - Scorers are randomly picked from the attacking team's roster, and possession immediately flips.

## API Implementation
The new endpoint lives at `POST /api/match`. It calculates all 90 minutes of gameplay instantaneously (statelessly) without any simulated asynchronous delays.

### Request Payload (JSON)
The endpoint expects strongly typed team structures:
```json
{
  "homeTeam": {
    "id": "team-uuid-1",
    "name": "Cyber United",
    "ovr": 85,
    "players": ["Neon Striker", "Hackerman"] 
  },
  "awayTeam": {
    "id": "team-uuid-2",
    "name": "Crypto FC",
    "ovr": 82,
    "players": ["Block Defender", "Chain Keeper"]
  }
}
```

### Response Payload (JSON)
It responds with the calculated match outcome and a chronological array of structured match events:
```json
{
  "homeScore": 2,
  "awayScore": 1,
  "events": [
    { "minute": 0, "type": "COMMENTARY", "text": "Match has started!" },
    { "minute": 14, "type": "COMMENTARY", "text": "Dangerous attack!" },
    { "minute": 14, "type": "GOAL", "text": "GOAL!!! Neon Striker scores for Cyber United!", "teamId": "team-uuid-1", "scorer": "Neon Striker" },
    { "minute": 45, "type": "HALF_TIME", "text": "Half-time. Teams head to the dressing rooms." },
    { "minute": 90, "type": "FULL_TIME", "text": "Full-time! The referee blows the final whistle." }
  ]
}
```

## Next Steps
The engine is completely stateless and deterministic based purely on the provided JSON body payload. It does not yet connect to Supabase. Future phases can expand tactical modifiers (formation impacts) and persist these results directly into the `matches` schema configured in Phase 2.
