# Project Anchor State

This document serves as the final architecture summary and state anchor for the Football Manager WebApp project.

## 1. ARCHITECTURE SUMMARY
- **Stack:** Next.js (App Router, Turbopack), Supabase (Auth, Row Level Security, Edge Functions, PostgreSQL RPCs).
- **Core DB Schema:** 
  - `users` (Tracking TP and FanCoins balances).
  - `players` (Featuring `lineup_status` and dynamic JSONB `stats`).
  - `teams` (Manager franchises).
  - `matches` (Aggregated via the dynamic `league_standings_view` for live points tracking).
- **Match Logic:** 
  - An atomic `conduct_match` RPC function utilizing the `UPDATE` pattern for unsimulated matches.
  - Matches deploy a mathematical RNG "Luck Factor" bounding total `ovr` variance between `0.85x` and `1.15x`.
  - Implements a strict currency/energy sink by automatically draining `15-20` stamina points exclusively from the `starting` 11 players.
- **API Status:** 
  - `/api/team/my-team`: Fully functional, returning `200 OK` with `{ team: null }` fallback to gracefully trigger onboarding without generic 404 console errors.
  - `/api/cron/process-matches`: Deployed as a secure, Vercel-triggered cron job integrating natively with the Telegram Bot API for real-time notifications.

## 2. SECURITY STATE
- **Race Conditions:** The TOCTOU vulnerability in `heal_player_with_tp` has been successfully eradicated via an atomic SQL `UPDATE ... WHERE balance_tp >= 50` transaction.
- **Row Level Security (RLS):** Currently set to `DISABLE` across all core tables to optimize development agility. It is mandated to revert to strict `POLICY` mode prior to production deployment.

## 3. PENDING ITEMS
- Implement manual team management, allowing users to swap bench players into the starting lineup.
- Implement the automated daily match scheduling logic to natively populate the `matches` table.

## 4. ENVIRONMENT
- **Platform:** Vercel-deployed serverless architecture.
- **Typing:** Strict TypeScript enforcement across all API routes and UI components.
- **Integration:** Telegram WebApp seamlessly enabled for persistent Auth and notification bridging.
