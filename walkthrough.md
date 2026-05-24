# System Audit & League Module Launch

The security fixes and new League feature implementation have been fully completed based on the approved architecture. Here is a breakdown of what was achieved:

> [!IMPORTANT]
> The database has been patched with a new dynamic SQL `VIEW` (`league_standings_view`) that recalculates W/D/L records and 3-point logic securely on the fly from the `matches` table. This prevents any out-of-sync states that standard tables or cron-jobs might suffer from.

## 1. TOCTOU Security Patch
The Race Condition vulnerability in `heal_player_with_tp` has been successfully eradicated. We deployed migration `00016_patch_heal_rpc.sql` to merge the "Balance Check" and the "TP Deduction" into a singular, atomic `UPDATE` clause:
```sql
UPDATE public.users SET balance_tp = balance_tp - 50 WHERE id = u_id AND balance_tp >= 50;
IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient Training Points'; END IF;
```
This guarantees that concurrent rapid-fire requests cannot trick the server into healing players for free if the balance drops below 50 TP milliseconds prior.

## 2. API 404 Routing Elimination
The `/api/team/my-team` API has been completely re-structured to adhere to cleaner REST patterns. It no longer throws HTTP `404 Not Found` when a new player connects without a team. Instead, it returns an HTTP `200 OK` with a clean `{ success: true, team: null, players: [] }` payload. 

The Dashboard (`app/page.tsx`) and Tactical pitch (`app/lineup/page.tsx`) have been updated to check for `json.team === null` in order to cleanly render the Onboarding flow. All misleading console and network errors have been cleared.

## 3. The League Module
The new competitive hub is live at `/league`.

- **Recent Match History (Left Column):** Features a scrollable, glassmorphic feed of all recent global games. Winning scores are highlighted in `neon-green`, drawing visual focus to dominant performances.
- **League Standings (Right Column):** Directly pulls from the dynamic `league_standings_view`. It ranks all managers by `PTS` (Wins = 3, Draws = 1).
- **Dynamic Identity:** The system cross-references the authenticated `userId`, pinpointing your team on the standings board and highlighting your specific row with a bright `border-neon-cyan` glow and backdrop shadow to easily locate yourself among the competition.

---

# Automated Match Engine & Notification Bridge

We have now deployed the core autonomous scheduling architecture:

## 1. Match Engine (SQL RPC)
Migration `00018_match_engine.sql` deploys the `conduct_match(m_id)` RPC. 
- It aggregates the combined `ovr` of the 11 starting players for both teams.
- To prevent purely deterministic gameplay, a randomized Luck Factor (+/- 15%) is applied to the aggregate power.
- Based on the strength variance, it calculates a realistic scoreline and explicitly `UPDATE`s the scheduled match in the `matches` table.
- **Stamina Drain:** In the exact same atomic transaction, all 22 active players suffer a 15-20 point stamina reduction, tying back directly into the TP Medical Center gameplay loop.

## 2. Telegram Bot Integration
The `app/api/cron/process-matches/route.ts` Vercel Cron endpoint acts as the autonomous operator.
- It fetches all unsimulated matches scheduled for today or earlier.
- It iterates through the schedule, executing `conduct_match` for each fixture.
- Upon resolution, it executes an `INNER JOIN` to fetch the registered `telegram_id` for both the Home and Away managers.
- It triggers a `POST` request to `api.telegram.org`, broadcasting real-time match results (Victory/Defeat/Draw, the exact scoreline, and the Stamina drained) directly to the users' Telegram applications.
