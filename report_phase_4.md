# Phase 4: Cron League Simulation Engine

## Overview
Phase 4 successfully integrates our PostgreSQL database schema (Phase 2) with the mathematical Match Simulation logic (Phase 3). We established an automated, secured endpoint designed to be triggered periodically as a CRON job. This endpoint drives the core game loop: pitting teams against each other, recording results, and calculating the league standings.

## Architecture & Implementation

### 1. Supabase Initialization (`lib/supabase.ts`)
A centralized Supabase client was introduced using `@supabase/supabase-js`. It securely loads the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ensuring a single robust connection interface to the backend.

### 2. Cron Endpoint (`app/api/cron/league-sim/route.ts`)
This `GET` route serves as the central hub for automated match processing. 
- **Security Check**: It expects an `Authorization: Bearer <CRON_SECRET>` header. If the header is missing or incorrect, it aggressively drops the request with a `401 Unauthorized` block to prevent public abuse.
- **Data Orchestration & Error Handling**: The route fetches active teams from the database, wrapped in rigorous `try/catch` checks. If fewer than 2 teams are registered, it correctly bypasses simulation to prevent errors.
- **Match Setup**: 
  - Iterates sequentially through available teams, pairing them off (`Team A` vs `Team B`).
  - Actively polls the `players` table to extract OVRs for the respective team rosters, applying a fallback metric of `50 OVR` if rosters are empty.

### 3. Simulation & Persistence
- **Math Engine**: Reuses the instantaneous Phase 3 mathematical model to simulate the 90 minutes statelessly using the dynamically fetched OVR capabilities.
- **Database Insertion**:
  - The final scores are inserted into the `matches` table tracking the specific fixtures (`is_simulated = true`).
  - **Read-Modify-Write Standings**: For both teams involved, it pulls the existing aggregate `league_standings` record. It recalculates aggregate metrics (Points: +3 for Win, +1 for Draw, +0 for Loss) alongside wins, draws, and matches played. If a team has no previous standing, it constructs the initial row.
  - All DB transactions are individually error-checked to ensure data integrity during partial failure states.

## Summary
The project now hosts a robust backend pipeline bridging user-managed database states with a dynamic gameplay simulation engine, laying the complete foundation for automated game sessions. The frontend layout remains untouched as per standard isolation requirements.
