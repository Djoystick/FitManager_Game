# Phase 2: Core Database Schema Migration

## Overview
As part of migrating the legacy Android Football Manager logic to a modern Telegram Mini App (TMA) architecture using Supabase, we have generated the core PostgreSQL schema.

## Legacy Analysis
An analysis of the legacy Kotlin models in `_legacy_source` (`Player.kt`, `Team.kt`, `LeagueStanding.kt`, etc.) was performed. The new TMA architecture evolves these models:
- **Players**: The legacy `Player` had `overallRating` and `potential`. These are mapped to `ovr` and `potential_limit` with standard 1-99 constraints. We introduced new TMA-specific attributes like `perks` (using `JSONB` for flexibility) and `is_nft_coach` to support the Web3 roadmap.
- **Teams & Users**: A new `users` table was added, linked to `telegram_id` and `wallet_address`. Teams are now directly associated with their owner's `user_id`.
- **Matches & Standings**: The matches structure explicitly captures simulated state (`is_simulated`). The `league_standings` table normalizes team performance stats, decoupling it from the main `teams` table where it formerly resided in the Kotlin `Team` data class.

## Schema Implementation
A new migration file has been created at `supabase/migrations/00001_create_core_tables.sql`.

The following tables and relationships were mapped:
1. `users`: Stores user profile data and Web3 balance (`balance_fancoins`).
2. `teams`: Associated to `users` via `user_id` foreign key.
3. `players`: Associated to `teams` via `team_id` foreign key. Includes constraints enforcing standard OVR ratings.
4. `matches`: Records home/away fixtures linking to `teams`.
5. `league_standings`: Links 1:1 with `teams`, isolating competition metrics (wins, losses, points).

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity. Foundational Row-Level Security (RLS) enablement comments have been included to facilitate future security configuration.
