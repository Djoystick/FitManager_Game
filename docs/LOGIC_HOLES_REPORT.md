# LOGIC HOLES REPORT — FitManager Game

**Audit Date:** 2025-06-14
**Audit Scope:** Phase 2 (Entity Lifecycle) + Phase 3 (Progression Dead Ends)
**Auditor:** Lead Architect & Systems Analyst

---

## Executive Summary

This report catalogs **21 logic holes** discovered during a deep audit of FitManager's core gameplay loops. The findings span two critical subsystems:

- **Entity Lifecycle (Phase 2):** Player aging, form decay, injuries, and retirement mechanics contain 11 issues, including one **critical bug** where real-match injuries are never persisted to the database.
- **Progression Dead Ends (Phase 3):** The economy and stamina loop contains 10 issues, including a **high-risk bankruptcy death spiral** where broke teams are permanently penalized with capped stamina.

The most severe finding is that **injuries generated during real league matches are cosmetic only** — they appear in match reports and trigger notifications, but the player is never actually marked as injured in the database. This means the entire injury subsystem is non-functional for the core gameplay loop.

---

## Risk Matrix

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1 | System is broken — core feature non-functional |
| HIGH | 4 | Game experience severely degraded or players trapped |
| MEDIUM | 7 | Unintended behavior, missing features, degraded UX |
| LOW | 9 | Minor inconsistencies, technical debt, dead code |

---

## Phase 2: Entity Lifecycle Holes

### L2-1: Real Match Injuries Are Cosmetic Only [CRITICAL]

**Files:** `app/actions/matchActions.ts:894-912`, `app/utils/matchEngine.ts:555-560`

The match engine generates injury events during fouls:
- Foul chance: 3.5% base (6% with Enforcer trait)
- 80% of fouls are outside the penalty box
- 25% of non-box fouls result in injury
- **Effective probability:** ~0.7% per attacking sequence

However, `resolveMatch()` never writes `is_injured: true` or `injury_matches_left` to the database. The post-match processing (lines 894-912) only sends a notification:

```typescript
// matchActions.ts:894-912 — NOTIFICATION ONLY
await supabaseAdmin.from('personal_notifications').insert({
  user_id: injTeamOwner.user_id,
  type: 'injury',
  title: 'Player injury',
  message: JSON.stringify({
    en: `${injEvent.player_name} was injured in a match.`,
  }),
});
```

**Contrast:** Bot match simulation (`calendarActions.ts:227-242`) DOES persist injuries:
```typescript
// calendarActions.ts:241-242 — ACTUALLY PERSISTS
playerUpdates[player.id] = {
  ...playerUpdates[player.id],
  is_injured: true,
  injury_matches_left: injuryMatches
};
```

**Impact:** Players are never actually injured from real league matches. The injury system is broken for the core gameplay loop.

---

### L2-2: No Natural Injury Healing for Real Matches [MEDIUM]

**Files:** `app/actions/calendarActions.ts:179-195`

Natural healing (decrementing `injury_matches_left` each round) only fires during bot match processing. Since real-match injuries are never persisted (L2-1), this healing path never triggers for them.

Bot-match injuries heal naturally (decrement each round). Real-match injuries don't exist in the database.

---

### L2-3: Medical Center "Heal Discount" Is Not Implemented [MEDIUM]

**Files:** `app/actions/trainingActions.ts:394`, `app/actions/baseActions.ts:82`

The Medical Center upgrade is documented as providing "+stamina recovery / heal discount." However:

```typescript
// baseActions.ts:82 — hardcoded cost
const spCost = Math.max(0, 100 - currentStamina);
```

No discount is applied based on Medical Center level. Players always pay full SP cost (1 SP per missing stamina point).

**Impact:** Medical Center upgrade provides no heal discount as advertised. The "heal discount" feature was designed but never implemented.

---

### L2-4: Pitch Level Injury Reduction Is Not Implemented [MEDIUM]

**Files:** `app/actions/trainingActions.ts:638`, `app/utils/matchEngine.ts:519-521`

Pitch level is documented as "Reduces injury chance by pitch_level × 2% per match." However, the match engine uses hardcoded foul probability:

```typescript
// matchEngine.ts:520
const foulChance = defDef.traits.includes('Enforcer') ? 0.06 : 0.035;
```

No pitch-level modifier exists. The feature was documented but never implemented in the engine.

**Impact:** Pitch upgrade provides no injury protection. Players pay FC for upgrades that don't work as described.

---

### L2-5: OVR Floor Inconsistency Between Systems [LOW]

**Files:** `app/api/cron/age-players/route.ts:63`, `supabase/migrations/00039_form_decay_and_economy_v2.sql:107`

Two different OVR floors exist:
- **Age decay:** `Math.max(1, ...)` — can decay to OVR 1
- **Form decay:** `GREATEST(40, ...)` — stops at OVR 40

A player can age-decay to OVR 1-39, then form decay never triggers (requires OVR > 78). This creates "zombie players" with OVR 1-39 that are functionally useless but still occupy roster slots.

---

### L2-6: Retirement at 35 Is Hard Cutoff With No Probability Curve [LOW]

**File:** `app/api/cron/age-players/route.ts:35`

```typescript
if (newAge >= 35) {
  // Player reaches retirement horizon
}
```

No randomness, no gradual retirement probability. All players retire at exactly 35. A 34-year-old star is guaranteed to retire next cron cycle. This removes emergent gameplay and strategic decision-making around player lifecycles.

---

### L2-7: Hall of Fame vs Academy Retirement Are Mutually Exclusive [LOW]

**Files:** `app/actions/playerActions.ts:84-141`, `app/actions/teamActions.ts:422-495`

- **Hall of Fame:** Requires OVR ≥ 85, deletes player immediately, grants prestige multiplier.
- **Academy:** Requires `is_retired = true` (age 35+), deletes player, grants academy perk.

A player at OVR 85+ under age 35 can only HoF-retire. By the time they reach 35 for Academy retirement, their OVR may have decayed below 85. The paths are time-gated and mutually exclusive, preventing strategic choice.

---

### L2-8: `age-players` Processes ALL Players Individually [LOW]

**File:** `app/api/cron/age-players/route.ts:32-86`

The cron iterates every active player with individual DB updates. For large player populations, this will timeout on Vercel's 10-second edge function limit.

**Contrast:** `form-decay` uses a single atomic SQL function (`apply_form_decay()`).

**Impact:** Scalability risk. Aging may silently fail for large populations.

---

### L2-9: Form Decay OVR Recalculation Is Approximate [LOW]

**File:** `supabase/migrations/00039_form_decay_and_economy_v2.sql:110`

The form decay function uses a stale `pac` value with a rough `v_decay_pts * 2` correction:
```sql
COALESCE((stats->>'pac')::int, 50)  -- will be stale but close enough
```

Only `pac` and `phy` are updated, but OVR is recalculated from all stats including the old `pac`. This causes OVR to drift slightly from actual stat values over time.

---

### L2-10: Stamina Regen Cron Excludes Injured Players [MEDIUM]

**File:** `app/api/cron/stamina-regen/route.ts:41`

```typescript
.eq('is_injured', false)  // explicitly excludes injured players
```

Injured players cannot regen stamina via cron. Combined with SP-based healing cost (1 SP per missing stamina), an injured player at 0 stamina costs 100 SP to heal. This is doubly punishing.

---

### L2-11: Admin Heal Uses Stale Column Name [LOW]

**File:** `app/actions/adminActions.ts:325`

```typescript
.update({ stamina: 100, is_injured: false, injury_duration: 0 })
```

Uses `injury_duration` instead of `injury_matches_left`. The admin heal may not properly clear injury state.

---

## Phase 3: Progression Dead End Holes

### L3-1: No Safety Net for Broke Teams [HIGH RISK]

**Impact:** No automatic FC stipend, daily login bonus, or bankruptcy recovery mechanism exists. A team at 0 FC with high-OVR players can only recover through match rewards (which are always positive, even on a loss). Recovery IS possible but slow and painful.

**Minimum daily income at 0 FC (stadium level 1, losing every match):**
- Loss reward: 100 FC
- Ticket revenue: ~1,251 FC
- Services revenue: ~30 FC
- **Total: ~1,381 FC/day**

**Minimum daily cost (11 players at 55 OVR):**
- Salary: ~275 FC/match × 2 = ~550 FC/day

**Net:** +831 FC/day (positive, but slow recovery from 0).

---

### L3-2: Bankruptcy Stamina Penalty Reapplied Every Match [HIGH RISK]

**File:** `app/actions/matchActions.ts:601-613`

```typescript
if ((afterUpdate?.balance_fancoins ?? 1) === 0 && totalSalary > totalReward) {
  await Promise.all(
    players.map(p =>
      supabaseAdmin.from('players')
        .update({ stamina: Math.min(Number(p.stamina ?? 30), 30) })
        .eq('id', p.id)
    )
  );
}
```

When FC = 0 AND salary > reward, ALL players are capped at stamina 30. This cap is re-applied after EVERY match, even if the stamina regen cron restores stamina between matches.

**Effect:** A bankrupt team plays at 0.75x effectiveness permanently until they win a match (which requires stamina > 30, which requires FC > 0).

---

### L3-3: No Minimum Stamina Requirement to Play [MEDIUM]

**Files:** `app/actions/matchActions.ts:300-308`

There is no stamina check before match simulation. The only check is whether the team has 11 healthy players. A team with all players at stamina 0 still plays at 55% effectiveness.

This prevents a hard lock but degrades gameplay quality severely.

---

### L3-4: Friendly Matches Have Lifetime Limit of 5 [MEDIUM]

**File:** `app/api/league/friendly/route.ts:29`

```typescript
if ((count || 0) >= 5) {
  return NextResponse.json({ success: false, error: 'Limit reached' }, { status: 403 });
}
```

Only 5 friendlies EVER — not per day, week, or season. Once exhausted, this FC/SP source is permanently gone. This is an early-game resource that disappears forever.

---

### L3-5: Quest Rewards Heavily Nerfed (45% FC Reduction) [LOW]

**File:** `app/api/quests/generate/route.ts:45`

```typescript
Math.floor(q.fc * 0.55)  // 45% nerf
```

Maximum daily quest FC: ~774 FC/day (3 quests × ~91 FC avg + 500 bonus).
This barely covers salary costs (~550 FC/day for a 55-OVR squad), providing minimal economic relief.

---

### L3-6: The "Death Spiral" Scenario [HIGH RISK]

**Trigger conditions:**
1. High-OVR squad (75+) + low stadium level
2. Losing streak
3. FC hits 0

**Cascade:**
1. Bankruptcy penalty caps stamina at 30
2. Team plays at 0.75x effectiveness
3. Keeps losing (can't win with debuff)
4. Penalty reapplied every match → never escapes 30 stamina
5. Recovery requires winning, which requires stamina > 30

**Verdict:** Technically recoverable (tickets provide positive income even on losses), but practically traps players in degraded state for multiple match cycles.

---

### L3-7: The "Injury Cascade" Scenario [MEDIUM RISK]

**Trigger conditions:**
1. Multiple starters injured
2. 0 SP (cannot heal)
3. Thin bench

**Cascade:**
1. Injured players excluded from stamina regen cron
2. Bench fills in, gets injured too
3. Fewer than 11 healthy players → technical forfeit
4. Forfeit still costs salary but earns minimal FC

**Verdict:** Partially locked. Can earn FC via forfeit, but cannot recover squad health without SP (walking).

---

### L3-8: W2E-Only Form Decay Trap [LOW RISK]

**Trigger conditions:**
1. Players OVR > 78
2. User stops walking/training

**Cascade:**
1. Daily `strength_coin` maintenance not paid
2. Stats decay daily (pac, phy)
3. OVR drops below competitive threshold
4. Fewer wins → less FC → spiral

**Verdict:** Slow degradation, not a hard lock. Designed to force W2E engagement.

---

### L3-9: Dead SQL RPCs / Migration Inconsistencies [LOW]

| Migration | RPC | Status |
|-----------|-----|--------|
| `00009_stamina_regen_rpc.sql` | `regenerate_stamina()` | Superseded by cron (percentage-based vs flat +30) |
| `00014_w2e_system.sql` | `convert_training_points()` | Superseded by `00027` SP system |
| `00029_phase8_5_tp_cleanup.sql` | `award_match_fancoins()` | Unused — TS uses `update_fancoins_after_match` with different formula |

These dead RPCs may confuse future developers or be accidentally invoked.

---

### L3-10: AI Economy Agent `medical_cost` Multiplier Disconnect [LOW]

**Files:** `app/api/cron/economy-agent/route.ts:101`, `app/actions/baseActions.ts:82`

The AI Economy Agent can adjust `medical_cost` (range 0.5-2.0):
```typescript
m.medical_cost = clamp(m.medical_cost, 0.5, 2.0);
```

But the heal cost in `baseActions.ts` is hardcoded:
```typescript
const spCost = Math.max(0, 100 - currentStamina);
```

The AI's `medical_cost` multiplier has no actual effect on healing costs. The feature was designed but never connected.

---

## Cross-Reference Matrix

| Finding | Related Findings | Shared Root Cause |
|---------|-----------------|-------------------|
| L2-1 (Injuries cosmetic) | L2-2, L3-7 | Injury system not wired to real matches |
| L2-3 (MC discount missing) | L2-4, L3-10 | Features designed but not implemented |
| L3-2 (Bankruptcy penalty) | L3-1, L3-6 | No safety net + persistent debuff = death spiral |
| L3-4 (Friendly limit) | L3-5 | Early-game resources permanently exhausted |
| L2-5 (OVR floor) | L2-6, L2-7 | Lifecycle mechanics not harmonized |

---

## Summary

The most critical issue is **L2-1**: real-match injuries are cosmetic only. This breaks the core injury gameplay loop and means players never face consequences from match fouls in league play.

The highest-risk progression issue is **L3-2/L3-6**: the bankruptcy death spiral. While technically recoverable through ticket revenue, the persistent stamina cap creates a frustrating experience that may cause player churn.

Several features (Medical Center discount, pitch injury reduction, AI medical cost) were designed and documented but never implemented in code. These represent incomplete features that should be either implemented or removed from documentation.
