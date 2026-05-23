# Phase 7: Economy Anti-Cheat & Hard Caps

## Overview
Phase 7 introduces critical economic safeguards to the "FitManager_Game" TMA. To prevent users from artificially farming Training Points (TP) through spamming fake workouts or grinding excessively, we have integrated two robust backend anti-cheat mechanics into our fitness log processing pipeline.

## 1. Anti-Cheat Logic Implementations
The `app/api/fitness/log/route.ts` endpoint has been upgraded to intercept and audit a user's recent history before issuing rewards.

### Mechanic 1: Diminishing Returns
- The system queries the `fitness_logs` table for any activities submitted in the last 24 hours.
- If a user submits multiple workouts of the *same* `activityType` (e.g., three separate 'Running' logs in one day), a **10% penalty** is applied to the base TP yield for every prior duplicate.
- **Cap**: The penalty is mathematically capped at a maximum of `50%` reduction.
- **Cross-Activity Exemption**: A user doing a 'Run' and then a 'Strength' session will not trigger this specific penalty, encouraging varied fitness routines.

### Mechanic 2: Daily Hard Cap
- The system sums the total `earned_tp` across all activities over the past 24 hours.
- A global constant `MAX_DAILY_TP` is set to `500`.
- If an incoming reward causes the daily total to exceed 500, the reward is automatically truncated (e.g., if you are at 450 TP and earn 100 TP, you will only be credited 50 TP). 
- If the cap is already met, the payload is safely logged for user history, but the `earned_tp` distributed is locked at `0`.

## 2. API Response Expansion
The JSON response has been updated to provide feedback on the economic audit, returning a nested `meta` object to the client:
```json
{
  "success": true,
  "earned_tp": 50,
  "balance_tp": 550,
  "meta": {
    "dailyLimitReached": true,
    "diminishingPenalty": 10
  }
}
```
*`diminishingPenalty` returns the exact percentage deducted, and `dailyLimitReached` flags whether the hard cap intercepted the reward.*

## Summary
These server-side checks securely protect the game economy without touching client code or modifying database schemas. The transaction flow guarantees that users are rewarded fairly for consistent, balanced fitness efforts rather than brute-force grinding.
