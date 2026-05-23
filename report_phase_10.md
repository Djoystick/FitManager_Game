# Phase 10: Luxury Tax Economy Sink

## Overview
Phase 10 introduces the "Luxury Tax" mechanic, serving as a vital economy sink and balancing lever for the "FitManager_Game" TMA ecosystem. By financially penalizing overly elite rosters during the lineup submission phase, the system actively discourages extreme "pay-to-win" hoarding and continually demands active fitness engagement from top-tier managers.

## 1. Database Schema Updates (`supabase/migrations/00004_add_lineup_status.sql`)
A precision schema alteration was performed:
- **`is_ready_for_match`**: Attached a new boolean column to the `teams` table (defaulting strictly to `false`). This acts as the state-gate; teams cannot be processed by the CRON simulation engine (Phase 4) unless this state flag is flipped to `true` by successfully paying their match dues.

## 2. Lineup Submission API (`app/api/team/submit-lineup/route.ts`)
A tightly-typed `POST` endpoint was deployed. It ingests the `{ userId, teamId }` payload and enacts the economic evaluation seamlessly.

### Mathematical Tax Formula
The game defines a baseline soft-cap `LEAGUE_OVR_CAP = 80` alongside a progressive penalty modifier `TAX_RATE_PER_OVR = 50`.
1. The server independently queries the `players` table and computes the squad's exact average OVR (rounded securely to the nearest integer).
2. The tax algorithm fires: `Tax = Math.max(0, (averageOvr - LEAGUE_OVR_CAP) * TAX_RATE_PER_OVR)`.
- *Case Study A: A beginner team with `75` OVR pays `0` tax.*
- *Case Study B: An elite team with `82` OVR pays `(82 - 80) * 50 = 100` FanCoins in Luxury Tax per match.*

### Transaction & State Integrity
Echoing the secure protocols developed in Phase 9, this API utilizes a manual, fail-safe simulated transaction sequence:
1. **Verification**: Mathematically verifies the `userId` possesses true ownership rights to the `teamId`.
2. **Economic Audit**: Scans the user's `balance_fancoins`. If the liquid balance falls short of the calculated tax, the endpoint aggressively rejects the lineup array with a `400 Bad Request`.
3. **Execution**: Siphons the FanCoin tax from the `users` table directly.
4. **State Transition**: Immediately updates `is_ready_for_match = true` on the target `teams` table. 
5. **Safety Rollback Protocol**: Should step 4 throw a PostgreSQL anomaly (e.g., connection lost during sequence), a catch-block triggers an immediate reversion of step 3. The FanCoins are completely refunded back to the `users` balance to ensure the player isn't unfairly charged for a voided submission.

### Success Response Layout
```json
{
  "success": true,
  "averageOvr": 82,
  "taxPaid": 100,
  "message": "Lineup submitted. Paid 100 FanCoins in Luxury Tax."
}
```

## Summary
The Luxury Tax elegantly balances the high-end competitive metagame. Users fielding elite Web3 squads must continuously generate internal FanCoins via real-world fitness routines (Phase 6) to afford deploying their teams. This crafts a perfectly closed feedback loop securely binding the "Fit-to-Play" exertion mechanics directly with the high-stakes football management layer.
