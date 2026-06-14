# ENGINE ECONOMY AUDIT REPORT — FitManager Game

**Audit Date:** 2025-06-14
**Scope:** Phase 2 — Match Engine & Economy Exploits
**Auditor:** Lead Security Researcher & Systems Analyst

---

## Executive Summary

This report catalogs **12 findings** across economy exploits, atomicity issues, cron overlaps, and match engine edge cases.

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 2 | increment_fancoins callable by anon, acceptOffer non-atomic |
| HIGH | 3 | 15+ non-atomic balance operations, league-autofill no CAS lock |
| MEDIUM | 4 | form-decay race window, world-readable economy tables, safeNum inflation |
| LOW | 3 | Penalty shootout no max rounds, weightedPick synthetic player, debugAddTonAction in prod |

---

## CRITICAL Findings

### E-1: `increment_fancoins` RPC Callable by Anon

**File:** `supabase/migrations/00010_increment_rpc.sql:3`

```sql
CREATE OR REPLACE FUNCTION increment_fancoins(u_id UUID, amount INT) RETURNS void AS $$
BEGIN
  UPDATE public.users SET balance_fancoins = balance_fancoins + amount WHERE id = u_id;
END;
$$ LANGUAGE plpgsql;
```

**Problem:** No `SECURITY DEFINER`. No `REVOKE` statement. Defaults to PUBLIC. Migration 00075 does NOT revoke this function.

**Exploit:**
```javascript
// From browser console or any HTTP client:
const { data, error } = await supabase.rpc('increment_fancoins', {
  u_id: '00000000-0000-0000-0000-000000000000',
  amount: 999999999
});
```

**Impact:** Unlimited FC injection. Complete economy destruction.

**Fix:** `REVOKE EXECUTE ON FUNCTION public.increment_fancoins(UUID, INT) FROM PUBLIC;`

---

### E-2: `acceptOffer` Not Atomic — FC Destruction on Partial Failure

**File:** `app/actions/transferOfferActions.ts:119-210`

The function performs **9+ separate database operations** with no transaction wrapping:

| Step | Line | Operation | Can Fail? |
|------|------|-----------|-----------|
| 7 | 162-166 | RPC `deduct_fancoins` from sender | Yes |
| 8 | 169 | RPC `increment_fancoins` to receiver | Yes |
| 9 | 173 | UPDATE `players` (transfer target) | Yes |
| 10 | 175 | UPDATE `players` (transfer offered) | Yes |
| 11 | 179 | UPDATE `transfer_offers` (mark accepted) | Yes |

**Failure scenarios:**
- Step 7 succeeds, step 8 fails → Sender loses FC, receiver never gets it. FC vanishes.
- Step 7 succeeds, step 9 fails → FC moved but player not transferred. Offer marked "accepted".
- No rollback logic exists.

**Fix:** Wrap in a database transaction or use a single atomic RPC.

---

## HIGH Findings

### E-3: 15+ Non-Atomic Balance Operations

All locations below use read-modify-write without WHERE guards on balance:

| # | File | Lines | Function | Vulnerability |
|---|------|-------|----------|---------------|
| 1 | `app/actions/baseActions.ts` | 226-231 | `upgradeStadium` | No `AND balance >= cost` |
| 2 | `app/actions/baseActions.ts` | 344-349 | `upgradeMedicalCenter` | Same |
| 3 | `app/actions/baseActions.ts` | 415-420 | `upgradeTrainingCenter` | Same |
| 4 | `app/actions/teamActions.ts` | 302-306 | `renamePlayerAction` | Read-modify-write |
| 5 | `app/actions/teamActions.ts` | 358 | `renameTeamAction` | Fallback after RPC |
| 6 | `app/actions/teamActions.ts` | 398 | `changeLogoAction` | Fallback after RPC |
| 7 | `app/actions/teamActions.ts` | 558-560 | `quickSellPlayer` | Fallback |
| 8 | `app/actions/scoutingActions.ts` | 115 | `signYouthIntake` | Read-modify-write |
| 9 | `app/actions/matchActions.ts` | 904-908 | `checkWinAchievement` | Read-modify-write |
| 10 | `app/api/cron/end-of-season/route.ts` | 330-333 | Season prize | Read-modify-write |
| 11 | `app/api/team/submit-lineup/route.ts` | 98-104 | Luxury Tax | Read-modify-write |
| 12 | `app/api/market/list/route.ts` | 101-107 | Listing Fee | Read-modify-write |
| 13 | `app/actions/baseActions.ts` | 100-104 | `healPlayer` | SP read-modify-write |
| 14 | `app/actions/baseActions.ts` | 512-517 | `healAllPlayers` | SP read-modify-write |
| 15 | `app/api/fitness/log/route.ts` | 128-133 | Fitness SP credit | SP read-modify-write |

**Exploit:** Two concurrent requests can both read `balance = 1000`, both compute `newBalance = 0`, both succeed → user gets 2 upgrades for the price of 1.

**Fix:** Add `WHERE balance_fancoins >= cost` to all deduction UPDATEs, or use atomic RPCs consistently.

---

### E-4: `league-autofill` Has No CAS Lock

**File:** `app/api/cron/league-autofill/route.ts:38-161`

- Lines 38-41: Queries `status = 'filling'` instances
- Lines 65-157: Inserts bots, teams, players, standings
- Line 161: Sets `status = 'active'` without CAS condition

**Problem:** If two cron invocations run simultaneously, both can:
1. Read the same `filling` instances
2. Insert duplicate bots (users, teams, players, standings)
3. Both try to activate

**Fix:** Add CAS: `.eq('status', 'filling')` on the status update.

---

### E-5: Upgrade Functions Non-Atomic (Double-Upgrade Exploit)

**File:** `app/actions/baseActions.ts:226-231, 344-349, 415-420`

All three upgrade functions follow:
```typescript
const newBalance = user.balance_fancoins - upgradeCost;
// No WHERE guard on balance
await supabaseAdmin.from('users').update({ balance_fancoins: newBalance }).eq('id', user.id);
```

**Exploit:** Concurrent requests can both pass the balance check and both deduct, giving 2 upgrades for the price of 1.

**Fix:** Use `deduct_fancoins` RPC (which has WHERE guard) or add `AND balance_fancoins >= upgradeCost`.

---

## MEDIUM Findings

### E-6: `form-decay` Race Window

**File:** `app/api/cron/form-decay/route.ts:25-62`

- Lines 25-43: Read `last_form_decay` and check 22h cooldown
- Lines 49-50: Execute `apply_form_decay()` RPC
- Lines 57-62: Update timestamp AFTER execution

**Problem:** Two requests can both pass the cooldown check before either writes the timestamp, causing double execution.

**Fix:** Update timestamp BEFORE execution (optimistic lock).

---

### E-7: `economy_state` and `economy_logs` World-Readable

**Files:** `supabase/migrations/00048_ai_economist.sql:45, 48`

AI multiplier settings and daily economy snapshots exposed to anonymous users.

---

### E-8: `safeNum()` Fallback Inflates Stats

**File:** `app/utils/matchEngine.ts:116-119`

```typescript
function safeNum(val: unknown, fallback = 50): number {
  const n = Number(val);
  return isFinite(n) ? n : fallback;
}
```

**Problem:** Null/NaN stats silently become 50. A GK with null shooting gets 50 shooting.

**Impact:** Match outcomes skewed for players with corrupted data.

**Fix:** Add logging when fallback is triggered. Use fallback of 1 for most contexts.

---

### E-9: Client-Controlled Timezone Offset

**File:** `app/api/fitness/sync/route.ts:18, 57-63`

```typescript
const { timezoneDate, timezoneOffsetMins } = await req.json();
const offsetMins = typeof timezoneOffsetMins === 'number' ? timezoneOffsetMins : now.getTimezoneOffset();
```

**Problem:** Client can manipulate timezone to shift daily reset boundary.

**Mitigation:** SQL function `sync_daily_steps` has guards, but manipulation vector exists.

---

## LOW Findings

### E-10: Penalty Shootout No Max Rounds

**File:** `app/utils/matchEngine.ts:788`

```typescript
while (round < maxRounds || homeScore === awayScore)
```

In sudden death, no maximum round limit. Theoretically infinite loop.

**Fix:** Add `&& round < 30` to the while condition.

---

### E-11: `weightedPick()` Synthetic Fallback

**File:** `app/utils/matchEngine.ts:213-222`

Returns a synthetic 50-stat dummy player when both pool and fallback are empty.

---

### E-12: `debugAddTonAction` in Production Code

**File:** `app/actions/marketActions.ts:227-257`

Properly guarded by `NODE_ENV !== 'development'`, but still bundled in production.

---

## Cron Overlap Analysis

| Cron Job | CAS Lock? | Idempotency? | Risk |
|----------|-----------|--------------|------|
| `end-of-season` | YES (status transition) | YES (`season_reward_paid`) | LOW |
| `league-autofill` | **NO** | Partial (schedule check) | **HIGH** |
| `form-decay` | No (timestamp-based) | Partial (22h cooldown) | **MEDIUM** |
| `stamina-regen` | N/A (idempotent by design) | N/A | LOW |
| `age-players` | N/A (idempotent by design) | N/A | LOW |

---

## Economy Exploit Summary

| Exploit | Vector | Impact | Difficulty |
|---------|--------|--------|------------|
| FC Injection | `increment_fancoins` RPC via anon | Unlimited FC | Trivial |
| Double Upgrade | Concurrent upgrade requests | 2 upgrades for 1 price | Easy |
| FC Destruction | `acceptOffer` partial failure | FC vanishes | Medium |
| Quest Steal | `quests/claim` body-based auth | 500+ FC/day | Trivial |
| Bot Duplication | `league-autofill` no CAS | Duplicate bots | Low |

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| P0 | E-1: increment_fancoins permissions | Add REVOKE |
| P0 | E-2: acceptOffer atomicity | Wrap in transaction |
| P1 | E-3: Non-atomic balance ops (15+) | Add WHERE guards |
| P1 | E-4: league-autofill CAS | Add CAS condition |
| P1 | E-5: Upgrade functions | Use atomic RPC |
| P2 | E-6: form-decay race | Update timestamp first |
| P2 | E-8: safeNum fallback | Lower fallback value |
| P3 | E-10: Penalty max rounds | Add round limit |
