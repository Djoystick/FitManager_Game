# Match Engine & Telegram Notification Bridge

This plan details the architecture for the Automated Match Engine, which resolves match scores based on lineup OVR and RNG, depletes player stamina, and dispatches real-time Telegram notifications.

## User Review Required

> [!IMPORTANT]
> The requirements state: *"Fetch scheduled matches for today -> call conduct_match(home_id, away_id) -> Insert result into matches table."*
> **Question:** Currently, the `matches` table handles both historical results and future scheduling (via `is_simulated = false`). If the Cron job fetches existing unsimulated matches, should the RPC **UPDATE** the existing row using a `match_id` rather than inserting a new one? 
> **Proposed Solution:** I recommend altering the RPC signature to `conduct_match(m_id UUID)` so it can look up the `home_id` and `away_id` natively, calculate the score, update the existing row, and flag `is_simulated = true`. Is this acceptable, or must it strictly be `conduct_match(home_id, away_id)` doing an `INSERT`?

## Proposed Changes

---

### 1. MATCH ENGINE (SQL RPC)
#### [NEW] `supabase/migrations/00018_match_engine.sql`
- Create the PostgreSQL RPC `conduct_match(m_id UUID)` (or `home_id, away_id` depending on feedback).
- **Core Logic**:
  1. Retrieve the starting 11 players for both Home and Away teams where `lineup_status = 'starting'`.
  2. Calculate the baseline team strength: `SUM(ovr)` for both teams.
  3. Introduce a **Random Factor (Luck/RNG)**: Add a randomized multiplier (e.g., +/- 10%) to each team's baseline OVR to simulate match unpredictability.
  4. Compare the finalized scores and map them into realistic football scorelines (e.g., `[2-1]`, `[0-0]`, `[3-0]`).
  5. Update the `matches` row with the generated `home_score` and `away_score`, and flag it as `is_simulated = true`.
  6. **Stamina Drain**: Atomically deduct between 15-20 stamina points from all 22 players involved in the match (ensuring it doesn't drop below 0).
  7. Return a JSON object containing the scores and team IDs for the notification payload.

### 2. TELEGRAM NOTIFICATION (API)
#### [NEW] `app/api/cron/process-matches/route.ts`
- Create a `GET` (or `POST`) route designed for Vercel Cron integration.
- **Workflow**:
  1. Authenticate the cron request (using a bearer token or Vercel cron headers).
  2. Query `matches` where `is_simulated = false` and `match_date <= NOW()`.
  3. Iterate through the matches and invoke `supabase.rpc('conduct_match', { m_id })`.
  4. Upon resolution, fetch the `telegram_id` for both the Home and Away users from the `users` table.
  5. Dispatch custom messages to the Telegram Bot API `sendMessage` endpoint (e.g., *"Match Result: Your team won 2-1 against [Opponent]!"*).

### 3. REPORTING
- Upon execution, I will generate `report_match_engine.md` detailing the mathematical formulas used for stamina depletion and OVR variance.

---

## Verification Plan
1. Manually insert a mock unsimulated match into the DB.
2. Hit `/api/cron/process-matches` manually.
3. Verify the match resolves, players lose 15-20 stamina, and Telegram API logs capture the notification payload.
