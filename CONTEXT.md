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

## 🚀 Updated Roadmap (Post-Audit Action Plan)

Based on a deep security and architecture audit, we are pivoting to prioritize Web3 Production Readiness before launching the Social Hub.

### 🔴 Phase 1: P0 Web3 Production Readiness (CRITICAL)
- **CI/CD & Tests:** Setup Vitest/Jest and GitHub Actions. We MUST cover the Match Engine and Economy functions with tests.
- **Real Economy Data:** Remove `Math.random()` stubs for `mintedToday`/`burnedToday`. Implement a real `treasury_transactions` table to track all TON/FC flow so the AI Economy Agent operates on real financial data.
- **Migration Cleanup:** Fix messy/duplicate Supabase migration numbers (00004, 00038, etc.) to ensure a reproducible database schema.

### 🟡 Phase 2: P1 Architecture & Code Quality
- **Refactoring:** Decompose monolithic files (`page.tsx`, `dictionaries.ts`, modals).
- **Type Safety:** Eliminate `any` and `@ts-ignore` in critical paths.
- **Licensing:** Add an open-source LICENSE to the repository.

### 🟢 Phase 3: Social Hub (Сводки)
- Build the global event feed (transfers, high-stakes match results).
- Implement league-specific feeds.
- Build anti-collusion mechanics for transfers (e.g., price clamping, cooldowns between same managers).

## IDE Instructions
If you are an AI assistant reading this after a fresh install or context wipe:
- We are currently in **Phase 1 (P0 Web3 Production Readiness)**.
- Focus strictly on setting up the test environment, cleaning migrations, and removing fake economy data before writing any new feature code.
