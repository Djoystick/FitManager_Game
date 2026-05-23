# Phase 6: Fit-to-Play Mechanics Integration

## Overview
Phase 6 implements the core gamification loop that defines the "FitManager_Game" economy. We have introduced a secure, server-side mechanism to log real-world physical activities and mathematically convert them into in-game **Training Points (TP)**, bridging the fitness tracking app components with the football management simulation.

## 1. Database Schema Updates (`supabase/migrations/00002_create_fitness_logs.sql`)
A new database migration script has been formulated to extend our core architecture:
- **`users` Table Alteration**: Added a new `balance_tp` integer column to track the accumulated Training Points currency globally for the user. (Defaults to `0`).
- **`fitness_logs` Table**: Established an immutable ledger tracking individual workouts. It stores:
  - `user_id` (foreign key, cascading)
  - `activity_type` (e.g., Run, Strength, Yoga)
  - `duration_minutes`
  - `calories`
  - `earned_tp` (Calculated securely on the server side to prevent client spoofing)

## 2. Fitness Logic API (`app/api/fitness/log/route.ts`)
A strictly typed Next.js `POST` API endpoint was created to act as the primary receiver of workout data.

### Request Payload Structure
The endpoint enforces the presence of specific strongly typed fields:
```json
{
  "userId": "uuid-string-of-the-user",
  "activityType": "Running",
  "durationMinutes": 45,
  "calories": 400
}
```

### TP Conversion Mathematics
To prevent simple linear farming, activities are weighted by intensity coefficients based on standard metabolic equivalents.
- **Running**: `(durationMinutes * 2) + (calories / 10)`
- **Strength**: `(durationMinutes * 3) + (calories / 15)`
- **Yoga/Other (Fallback)**: `(durationMinutes * 1)`
*Note: All floating outputs are strictly floored to integers, and bound-checked to prevent negative point issuance.*

### Database Workflow
The endpoint executes a secure backend read-modify-write sync pattern:
1. Performs a `SELECT` validating the User UUID and isolating their current `balance_tp`.
2. Emits an `INSERT` saving the raw biometric data and calculated yield into `fitness_logs`.
3. Issues an `UPDATE` patching the `users` table with the newly aggregated `balance_tp`.

### Response Payload Structure
The client receives the transactional delta and their new aggregate global balance:
```json
{
  "success": true,
  "earned_tp": 130,
  "balance_tp": 130
}
```

## Summary
The TMA backend is now fully capable of acting as an economic faucet, parsing real-world physical exertion metrics into usable game currency without compromising database integrity. The frontend remains fully untouched, maintaining isolated development cycles.
