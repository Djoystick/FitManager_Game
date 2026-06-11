# FitManager Game Context & Anchoring Document

## Project Overview
FitManager is a Telegram Mini App (TMA) Web3 football manager on the TON blockchain with Move-to-Earn (M2E) elements. Players manage teams, train players using Sweat Points (from physical activity) or FanCoins, and compete in 10-tier global leagues. Matches are simulated asynchronously.

## Current State & Recent Fixes
1. **Match Engine & Leagues:**
   - Leagues run automatically using Vercel cron jobs (`league-autofill`, `end-of-season`, `process-matches`).
   - The end-of-season logic now has robust CAS locking (status transitions `active` -> `finishing` -> `finished`) to prevent double-processing and double payouts from the Treasury.
   - Teams are properly relegated/promoted and pushed to a new league instance (`status: filling`).
2. **Dashboard & Lobby Timer Fix:**
   - Fixed the `Unassigned` bug on the frontend. The `maybeSingle()` queries were failing because a team has multiple rows in `league_standings` over its lifetime. We now fetch the latest active/filling instance using `in('league_instances.status', ['active', 'filling'])` with `.limit(1)`.
   - The offseason lasts 24 hours. Once 24 hours pass, the client triggers `/api/league/trigger-autofill`, which automatically populates bots, creates the schedule, and transitions the league to `active`.
3. **Security Patches (Phases 1–3):**
   - **Phase 1 (Task 001):** Fixed C13 (lineup_status typo in friendly match) and C1 (userId auth bypass in fitness/log and complete-onboarding).
   - **Phase 2 (Task 002):** Migrated 8 API routes from body/query userId to cookie-based auth (`tg_user_id`).
   - **Phase 3 (Task 003 — in progress):** Fixing cron/webhook security — adding CRON_SECRET auth to `bot/register`, removing localhost bypasses from `stamina-regen` and `age-players`, fixing conditional bypass in `economy-agent`, removing fallback JWT secret from `marketActions.ts`.

## Next Steps: Achievements System (Ачивки)
The next major feature to implement is the **Achievements System**.
- We need to implement 25 achievements across different categories (e.g., matching the `ACHIEVEMENTS.md` or lore documents if they exist).
- This involves adding an `achievements` table or JSON column in the database.
- Building the UI for the Achievements tab.
- Integrating event hooks in the backend (e.g., when a match finishes, when a player is trained, when the treasury is drained) to check and unlock achievements and reward the user.

## IDE Instructions
If you are an AI assistant reading this after a fresh install or context wipe:
- You are working in a Next.js App Router codebase.
- We use Supabase (PostgreSQL) for DB and Auth, and TailwindCSS for styling.
- All styles should match the cyberpunk/neon aesthetic (Midnight Command Center).
- Proceed directly to designing the database schema for the Achievements and implementing the backend logic.
