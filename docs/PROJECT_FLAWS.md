# FitManager Project Audit — Critical Findings

> **Role:** Lead Game Architect & Code Auditor
> **Date:** June 2026
> **Scope:** Full codebase audit — Security, Architecture, Economy, Social

---

## Executive Summary

| Severity | Count | Category Breakdown |
|----------|-------|--------------------|
| **CRITICAL** | 8 | 4 Security, 4 Architecture |
| **HIGH** | 12 | 3 Security, 5 Architecture, 4 Economy |
| **MEDIUM** | 9 | 3 Security, 4 Architecture, 2 Economy |

**Verdict:** FitManager has a polished UI and a sophisticated match engine, but is built on a **critically insecure foundation**. RLS is disabled on all core tables, multiple API routes have no authentication, and server actions are vulnerable to IDOR attacks. The economy has no functioning inflation controls. These must be fixed before any production launch.

---

## 1. Security Vulnerabilities

### 1.1 CRITICAL — RLS Disabled on ALL Core Tables

**File:** `supabase/migrations/00001_create_core_tables.sql:64-68`

```sql
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
```

**Impact:** Any client using the Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) can read AND write ANY row in ANY core table. This means:
- Any user can read any other user's `balance_fancoins`, `balance_ton`, `sweat_points`, `wallet_address`, `google_refresh_token`.
- Any user can UPDATE any other user's currency balances directly.
- Any user can DELETE any team or player.

**Fix:** Enable RLS on all core tables with proper SELECT/INSERT/UPDATE/DELETE policies.

---

### 1.2 CRITICAL — Friendly Match Auth Bypass

**File:** `app/api/league/friendly/route.ts:7`

```typescript
const { userId } = body;  // ← userId from unverified request body
```

**Impact:** Any unauthenticated attacker can POST to `/api/league/friendly` with an arbitrary userId to farm 500 FC + 20 SP per match (up to 5 times per user per day). This is a direct currency injection vulnerability.

**Fix:** Read userId from the `tg_user_id` cookie, not the request body. Add Supabase admin client for verification.

---

### 1.3 CRITICAL — Notifications POST Endpoint Has No Auth

**File:** `app/api/notifications/route.ts:30-50`

The POST handler marks notification IDs as read with zero authentication. Any caller can mark any notification IDs as read.

**Fix:** Add cookie-based auth check, verify notification ownership before update.

---

### 1.4 CRITICAL — Multiple API Routes Exposed Without Authentication

| Endpoint | File | Issue |
|----------|------|-------|
| `/api/matches/recent` | `app/api/matches/recent/route.ts:12` | Accepts arbitrary `teamId` from query |
| `/api/matches/upcoming` | `app/api/matches/upcoming/route.ts:11` | Accepts arbitrary `teamId` from query |
| `/api/match/history` | `app/api/match/history/route.ts:4` | Returns all matches to any caller |
| `/api/market/active` | `app/api/market/active/route.ts:4` | Returns all listings (seller_ids) |

**Fix:** Add cookie-based auth to all routes. Validate that the requested resource belongs to the authenticated user.

---

### 1.5 HIGH — IDOR in Server Actions (11+ functions)

These `'use server'` functions accept userId/teamId as parameters instead of reading from the authenticated cookie:

| Function | File:Line | Parameter |
|---|---|---|
| `getMatchHistory(userId)` | `matchActions.ts:57` | `userId` |
| `getMatchSchedule(userId)` | `matchActions.ts:126` | `userId` |
| `getUnviewedMatch(userId)` | `matchActions.ts:584` | `userId` |
| `getUnseenMatches(teamId)` | `matchActions.ts:708` | `teamId` |
| `markMatchesAsViewed(matchIds, teamId)` | `matchActions.ts:743` | `teamId` |
| `getUpcomingOpponentScoutReport(userId)` | `scoutActions.ts:29` | `userId` |
| `getClubInfrastructureData(userId)` | `trainingActions.ts:496` | `userId` |
| `getTrainingCampData(userId)` | `trainingActions.ts:573` | `userId` |
| `getNextOpponentData(userId)` | `scoutingActions.ts:256` | `userId` |
| `getLastSeasonResult(teamId)` | `seasonActions.ts:10` | `teamId` |
| `getOpponentScoutReportByTeamId(...)` | `scoutActions.ts:136` | Both params |

**Fix:** All functions should read userId from `cookies()` internally. Remove userId parameters from function signatures.

---

### 1.6 HIGH — CRON_SECRET_MANUAL Leaked via Query Parameters

**Files:**
- `app/api/cron/process-matches/route.ts:47-49`
- `app/api/cron/form-decay/route.ts:18`
- `app/api/cron/match-warning/route.ts:41`

```typescript
const manualSecret = req.nextUrl?.searchParams?.get('secret');
const validSecret = manualSecret === process.env.CRON_SECRET_MANUAL;
```

Query parameters are logged in server access logs, cached by CDNs, visible in browser history, and sent in Referer headers. This effectively leaks the secret through multiple channels.

**Fix:** Remove query parameter auth entirely. Use only Bearer token auth. Rotate both `CRON_SECRET` and `CRON_SECRET_MANUAL` immediately.

---

### 1.7 HIGH — Telegram Webhook Has No Source Verification

**File:** `app/api/bot/webhook/route.ts:56`

```typescript
await bot.handleUpdate(body);  // ← accepts ANY POST body
```

No verification that the request came from Telegram servers. Telegram provides `X-Telegram-Bot-Api-Secret-Token` header for this purpose.

**Fix:** Add `X-Telegram-Bot-Api-Secret-Token` header validation.

---

### 1.8 HIGH — Admin Actions Exported as Public Server Actions

**File:** `app/actions/adminActions.ts:26`

`executeBotSeeding()` is exported as a public server action. While `seedBotLeague()` checks admin status, the underlying function can be called directly by any client.

**Fix:** Remove `export` from `executeBotSeeding` or add admin check inside it.

---

### 1.9 MEDIUM — CRON_SECRET Misused as JWT Signing Key

**File:** `app/actions/marketActions.ts:256`

```typescript
const jwtSecret = process.env.CRON_SECRET;  // ← used for Free Agent JWTs
```

If `CRON_SECRET` is compromised via the query parameter leak (1.6), an attacker could forge Free Agent tokens with arbitrary stats and prices.

**Fix:** Use a separate `JWT_SECRET` environment variable for game-state tokens.

---

### 1.10 MEDIUM — Missing Rate Limiting

No rate limiting on any user-facing endpoints. An attacker could spam `/api/league/friendly` (1.2), `/api/fitness/log`, or `/api/bot/webhook` to cause denial of service.

**Fix:** Add rate limiting middleware (e.g., `@vercel/rate-limit` or custom).

---

## 2. Architectural Flaws

### 2.1 CRITICAL — resolveMatch Lacks Row-Level Locking

**File:** `app/actions/matchActions.ts:190-207`

```typescript
const { data: match } = await supabaseAdmin
  .from('league_matches').select('*').eq('id', matchId).single();
// ...
if (match.status === 'completed' || match.is_played) return;
// ... simulate ...
await supabaseAdmin.from('league_matches').update({ status: 'completed', ... });
```

No `SELECT ... FOR UPDATE` or `WHERE status = 'pending'` in the UPDATE. Two concurrent invocations (user-triggered + cron) can both read `status: 'pending'`, both proceed, and double-apply:
- Stamina drain
- FC rewards
- Standings updates

This is a P0 exploit: unlimited free FC farming by triggering the same match twice.

**Fix:** Use `SELECT ... FOR UPDATE` or add `WHERE status = 'pending'` to the UPDATE query. Better: use an atomic RPC function.

---

### 2.2 CRITICAL — Non-Atomic Balance Operations (3 functions)

| Function | File | Issue |
|---|---|---|
| `upgradeBuildingAction` | `trainingActions.ts:440-457` | Read-modify-write without lock |
| `batchTrainPlayerAction` | `trainingActions.ts:240-385` | Reimplements RPC logic with vulnerable pattern |
| `buyFreeAgentAction` | `marketActions.ts:338-376` | Read-modify-write without lock |

All three read `balance_fancoins`, compute a new value, then write it back. Under concurrent load, two requests can both read the same balance and both pass the check.

**Fix:** Replace with atomic RPC calls (`deduct_fancoins` exists and is atomic) or wrap in `BEGIN`/`COMMIT` with `FOR UPDATE` locks.

---

### 2.3 HIGH — Two Different Cost Formulas for Building Upgrades

| Route | File:Line | Formula | L5 Cost | L9 Cost |
|---|---|---|---|---|
| `/api/infrastructure` POST | `infrastructure/route.ts:84` | `level * 1000` (linear) | 5,000 FC | 9,000 FC |
| `upgradeBuildingAction` | `trainingActions.ts:442` | `3000 * level^1.8` (exponential) | 53,977 FC | 182,900 FC |

Users can use the POST API to upgrade buildings at ~1/30th of the intended cost at higher levels.

**Fix:** Unify to a single cost formula. Remove one of the two entry points.

---

### 2.4 HIGH — economy_state Multipliers Are Dead Code

**File:** `app/api/cron/economy-agent/route.ts:142-147`

The AI Economy Agent writes `match_reward_multiplier`, `medical_cost_multiplier`, `stadium_tax_multiplier`, `scouting_cost_multiplier` to `economy_state`. **No code in the entire codebase reads from this table.**

Match rewards use hardcoded values (`matchActions.ts:488-489`). The entire AI economy adjustment system is non-functional.

**Fix:** Wire up multipliers to the actual reward/cost calculation paths, or remove the dead code.

---

### 2.5 HIGH — Form System Is Dead Code

**File:** `app/actions/matchActions.ts:357`

```typescript
result = runMatchEngine(homeLineup, awayLineup, homeBench, awayBench, homeGreen, awayGreen, homeTactic, awayTactic);
// homeForm and awayForm are OMITTED — default to []
```

The `calcFormBonus` function in `matchEngine.ts:747-753` always returns 0, and the W-W-W / L-L-L bonus system is dead code.

**Fix:** Pass match form data (last 3 results) to the match engine.

---

### 2.6 HIGH — FC Fallback Negates Atomicity Fix

**File:** `app/actions/matchActions.ts:524-531`

When the `update_fancoins_after_match` RPC fails, the code falls back to:
```typescript
const currentBalance = Number(fallbackUser?.balance_fancoins ?? 0);
const newBalance = Math.max(0, currentBalance - totalSalary + totalReward);
await supabaseAdmin.from('users').update({ balance_fancoins: newBalance }).eq('id', userId);
```

This is exactly the read-modify-write race condition the R6 fix was designed to eliminate.

**Fix:** Remove the fallback entirely. If the RPC fails, log the error and alert — don't silently use an unsafe path.

---

### 2.7 HIGH — Position Group Overlap in Match Engine

**File:** `app/utils/matchEngine.ts:220-223`

```typescript
const isMID = (pos: string) => ['MID', 'CM', 'CAM', 'CDM', 'RM', 'LM'].includes(pos);
const isFWD = (pos: string) => ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM'].includes(pos);
const isDEF = (pos: string) => ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(pos);
```

CAM appears in both `isMID` and `isFWD`. CDM appears in both `isDEF` and `isMID`. This inflates pool sizes and causes the same player to be picked for different roles.

**Fix:** Define exclusive position groups. CAM should be MID-only or FWD-only, not both.

---

### 2.8 MEDIUM — Free Agents Missing `dribbling` Stat

**File:** `app/actions/marketActions.ts:260-266, 291-302`

Free agents are generated with 5 stats (`pace`, `shooting`, `passing`, `defending`, `physical`) but `dribbling` is absent. `safeNum(undefined, 50)` defaults to 50 in the engine, meaning all free agents play at 50 dribbling regardless of their displayed OVR.

**Fix:** Add `dribbling` stat generation for free agents.

---

### 2.9 MEDIUM — simulateNextPendingMatch Triggers Round-Wide Side Effects

**File:** `app/actions/matchActions.ts:682-697`

When a single user calls `simulateNextPendingMatch`, it resolves ALL pending matches in the round. This means one user's action triggers FC transactions, stamina drains, and standings updates for all other teams — including teams whose owners didn't consent.

**Fix:** Restrict to user's own match only, or require cron-level auth for round simulation.

---

### 2.10 MEDIUM — Static Stamina Despite "Dynamic" Claims

**File:** `app/utils/matchEngine.ts:796-805`

`drainStamina` is called once at match start with estimated possession. The `liveStaminaMap` is fixed as the average of start/end values. Players who get substituted or receive red cards early still have the same fixed stamina throughout — the "dynamic stamina" system is actually static.

**Fix:** Either implement true per-attack stamina updates, or remove the misleading naming.

---

## 3. Economy Problems

### 3.1 HIGH — Match Reward Income Exceeds All FC Sinks

**File:** `app/actions/matchActions.ts:486-509`

Income per match: 500 FC base (win) + 150 × stadiumLevel + ticketRevenue + servicesRevenue. At stadium L5: easily 1500+ FC per match per team.

Sinks: Building upgrades (expensive but one-time), listing fees (small). No ongoing FC sink matches the match income rate. The AI Economy Agent was supposed to adjust `stadium_tax_multiplier` and `medical_cost_multiplier`, but those multipliers are never read (see 2.4).

**Impact:** Steady FC inflation. Currency becomes meaningless over time.

---

### 3.2 HIGH — RNG Exploit via Match Replay

**File:** `app/actions/matchActions.ts:500`

```typescript
const fillRate = 0.60 + Math.random() * 0.30;  // ticket revenue
```

Since `resolveMatch` can be retried (see 2.1), a user could trigger the same match repeatedly until they roll a high fill rate, maximizing revenue.

**Fix:** Use deterministic randomness (seed based on match ID) for all economy-critical RNG.

---

### 3.3 HIGH — Bot Teams Mint FC From Thin Air

**File:** `app/api/cron/league-autofill/route.ts:75`

Bots are created with `balance_fancoins: Math.floor(Math.random() * 5000)`. When bots play matches and win, `resolveMatch` credits their owners FC. If bot "owners" are not real users, this FC enters circulation as unbacked inflation.

**Fix:** Set bot initial FC to 0. Do not credit FC to non-existent users.

---

### 3.4 HIGH — No W2E Coin Sinks

**Files:** `app/actions/trainingActions.ts`

The only use of `cardio_coin`, `fitness_coin`, `ball_coin`, `strength_coin` is stat training. Once a player's stats hit 99, there's nothing to spend coins on. Coins accumulate indefinitely with no purpose.

**Fix:** Add coin sinks (cosmetics, boosters, player traits, training camps).

---

### 3.5 MEDIUM — Treasury prize_pool_ton Has No Audit Trail

**File:** `supabase/migrations/00032_phase9_web3_market.sql:208-224`

3% of every market transaction goes to `prize_pool_ton`. The `safe_deduct_treasury` RPC allows draining, but there's no record of WHERE the drained TON goes.

**Fix:** Log all treasury deductions to `treasury_transactions` with a `reason` field.

---

### 3.6 MEDIUM — economy_agent Logs Total Users as "Active"

**File:** `app/api/cron/economy-agent/route.ts:28-35`

```typescript
const activeUsers = users.length;  // ← ALL users, not active-in-24h
```

The `economy_logs` column is `active_users_today`, which is misleading.

**Fix:** Filter by `last_active` timestamp or activity within 24h.

---

## 4. Recommended Fixes (Prioritized)

### P0 — Must Fix Before Any Production Launch

1. **Enable RLS on ALL core tables** with proper policies
2. **Fix `/api/league/friendly`** to use cookie auth
3. **Add `SELECT ... FOR UPDATE` + status check** to `resolveMatch`
4. **Replace non-atomic balance operations** with atomic RPCs
5. **Remove `CRON_SECRET_MANUAL` query parameter** from all cron endpoints
6. **Unify building upgrade cost formula** across both entry points

### P1 — Fix Within First Sprint

7. Wire up `economy_state` multipliers or remove dead code
8. Pass match form data to the match engine
9. Fix position group overlap (CAM, CDM)
10. Add `dribbling` stat to free agents
11. Fix IDOR in server actions (remove userId params)
12. Add auth to unprotected API routes

### P2 — Fix Within First Month

13. Add rate limiting to all user-facing endpoints
14. Use deterministic RNG for economy-critical paths
15. Set bot initial FC to 0
16. Add treasury audit trail
17. Add W2E coin sinks
18. Add Telegram webhook source verification

---

*Report generated by Lead Game Architect audit — FitManager June 2026*
