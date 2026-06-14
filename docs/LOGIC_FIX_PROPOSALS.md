# LOGIC FIX PROPOSALS — FitManager Game

**Audit Date:** 2025-06-14
**Audit Scope:** Phase 2 (Entity Lifecycle) + Phase 3 (Progression Dead Ends)
**Author:** Lead Architect & Systems Analyst

---

## Executive Summary

This document proposes architectural fixes for 21 logic holes discovered during the global logic audit. Fixes are prioritized by severity and organized into four tiers:

- **P0 (Critical):** Must fix before production launch — core features are broken
- **P1 (High):** Fix immediately after launch — severely degrades player experience
- **P2 (Medium):** Fix in next sprint — missing features, inconsistent behavior
- **P3 (Low):** Technical debt cleanup — dead code, minor inconsistencies

---

## P0: Critical Fixes

### Fix P0-1: Persist Real-Match Injuries to Database

**Addresses:** L2-1, L2-2

**Problem:** The match engine generates injury events during fouls, but `resolveMatch()` never writes `is_injured: true` or `injury_matches_left` to the database. Injuries are cosmetic only.

**Proposal:** Add injury persistence logic to `resolveMatch()` in `app/actions/matchActions.ts`.

**Implementation:**

```typescript
// In resolveMatch(), after the match engine runs (line ~382)
// Process injury events from the match engine
const injuryEvents = result.events.filter(
  (e: any) => e.type === 'injury' && 'player_id' in e
);

for (const inj of injuryEvents) {
  const injEvent = inj as { player_id: string };
  const injuryDuration = Math.floor(Math.random() * 3) + 1; // 1-3 matches

  await supabaseAdmin
    .from('players')
    .update({
      is_injured: true,
      injury_matches_left: injuryDuration,
    })
    .eq('id', injEvent.player_id);
}
```

**Key decisions:**
- Injury duration: 1-3 matches (matching bot match logic)
- Injured players are automatically excluded from stamina regen cron (already implemented)
- Natural healing via `calendarActions.ts:179-195` will now fire for real-match injuries

**Files to modify:**
- `app/actions/matchActions.ts` — add injury persistence after match engine output

---

### Fix P0-2: Bankruptcy Death Spiral Break

**Addresses:** L3-2, L3-6

**Problem:** When FC = 0, all players are capped at stamina 30 after every match. This cap is re-applied every match, creating a permanent debuff that only lifts on a win. Teams stuck in this spiral lose repeatedly because they can't perform well enough to win.

**Proposal:** Change the bankruptcy penalty from a **permanent cap** to a **one-time debuff** with a recovery window.

**Implementation:**

```typescript
// In matchActions.ts:601-613, replace current logic:
if ((afterUpdate?.balance_fancoins ?? 1) === 0 && totalSalary > totalReward) {
  // ONE-TIME penalty: reduce stamina by 20% (not cap at 30)
  // This gives the team a chance to recover with cron regen
  await Promise.all(
    players.map(p => {
      const currentStamina = Number(p.stamina ?? 50);
      const penalizedStamina = Math.max(10, Math.floor(currentStamina * 0.80));
      return supabaseAdmin
        .from('players')
        .update({ stamina: penalizedStamina })
        .eq('id', p.id);
    })
  );
}
```

**Alternative (more generous):** Remove the bankruptcy stamina penalty entirely and rely on the natural difficulty of playing at 0 FC (no building upgrades, no squad improvements) as the consequence.

**Key decisions:**
- Option A: 20% stamina reduction (one-time, not re-applied)
- Option B: Remove penalty entirely (simpler, less punishing)
- Recommendation: Option A — maintains some consequence without creating death spiral

**Files to modify:**
- `app/actions/matchActions.ts` — modify bankruptcy penalty logic

---

## P1: High-Priority Fixes

### Fix P1-1: Implement Medical Center Heal Discount

**Addresses:** L2-3

**Problem:** Medical Center upgrade is documented as providing "heal discount" but the heal cost is hardcoded at `100 - currentStamina` SP.

**Proposal:** Apply a discount based on Medical Center level.

**Implementation:**

```typescript
// In baseActions.ts:healPlayer(), after calculating spCost:
const { data: infra } = await supabaseAdmin
  .from('infrastructure')
  .select('medical_center_level')
  .eq('team_id', team.id)
  .maybeSingle();

const medLevel = infra?.medical_center_level ?? 1;
// Level 1: 0% discount, Level 2: 10%, Level 3: 20%
const discount = Math.min(0.20, (medLevel - 1) * 0.10);
const discountedCost = Math.floor(spCost * (1 - discount));
```

**Key decisions:**
- Discount range: 0% (L1) → 10% (L2) → 20% (L3)
- Maximum discount: 20% (prevents infinite healing at high levels)
- Applies to both `healPlayer()` and `healAllPlayers()`

**Files to modify:**
- `app/actions/baseActions.ts` — add Medical Center discount to heal functions

---

### Fix P1-2: Implement Pitch Level Injury Reduction

**Addresses:** L2-4

**Problem:** Pitch level is documented as reducing injury chance but the match engine uses hardcoded foul probability.

**Proposal:** Modify the match engine to apply pitch-level injury reduction.

**Implementation:**

```typescript
// In matchEngine.ts, modify foul resolution (line ~519):
const baseFoulChance = defDef.traits.includes('Enforcer') ? 0.06 : 0.035;
// Pitch level reduces injury chance (not foul chance)
// Level 1: 0% reduction, Level 2: 2%, Level 3: 4%, etc.
const injuryReduction = Math.min(0.15, (pitchLevel - 1) * 0.02);
const injuryChance = 0.25 * (1 - injuryReduction); // 25% base injury on foul

if (r < 0.55) {
  // Yellow card
} else if (r < 0.55 + injuryChance) {
  // Injury (reduced by pitch level)
} else {
  // Red card
}
```

**Key decisions:**
- Pitch level reduces injury probability, not foul probability
- Maximum reduction: 15% (at pitch level 8+)
- Must pass `pitchLevel` as parameter to `simulateMatch()`

**Files to modify:**
- `app/utils/matchEngine.ts` — add pitch level parameter, modify injury logic
- `app/actions/matchActions.ts` — pass pitch level to match engine

---

### Fix P1-3: Add Natural Injury Healing for All Matches

**Addresses:** L2-2

**Problem:** Natural healing (decrementing `injury_matches_left`) only fires during bot match processing. Real-match injuries (once fixed per P0-1) need the same healing path.

**Proposal:** Ensure injury healing fires after every match resolution, not just bot matches.

**Implementation:**

```typescript
// In matchActions.ts, after applyFcTransaction (line ~620):
// Process natural injury healing for all injured players on both teams
const processInjuryHealing = async (teamId: string) => {
  const { data: injuredPlayers } = await supabaseAdmin
    .from('players')
    .select('id, injury_matches_left')
    .eq('team_id', teamId)
    .eq('is_injured', true);

  if (!injuredPlayers || injuredPlayers.length === 0) return;

  for (const p of injuredPlayers) {
    const newLeft = (p.injury_matches_left || 1) - 1;
    if (newLeft <= 0) {
      await supabaseAdmin
        .from('players')
        .update({ is_injured: false, injury_matches_left: 0 })
        .eq('id', p.id);
    } else {
      await supabaseAdmin
        .from('players')
        .update({ injury_matches_left: newLeft })
        .eq('id', p.id);
    }
  }
};

await processInjuryHealing(match.home_team_id);
await processInjuryHealing(match.away_team_id);
```

**Key decisions:**
- Healing fires after every match (real and bot)
- `injury_matches_left` decrements by 1 per match
- When reaches 0, player is healed automatically

**Files to modify:**
- `app/actions/matchActions.ts` — add injury healing after match resolution

---

### Fix P1-4: Friendly Match Limit Reset

**Addresses:** L3-4

**Problem:** Friendly matches have a lifetime limit of 5, permanently removing this FC/SP source.

**Proposal:** Reset friendly match count at season boundaries.

**Implementation:**

```typescript
// In friendly/route.ts, replace count check:
// OLD: count >= 5 (lifetime)
// NEW: count >= 5 (per season)

// Option A: Store season_start in system_config and count friendlies since then
const { data: seasonConfig } = await supabaseAdmin
  .from('system_config')
  .select('value')
  .eq('key', 'current_season_start')
  .maybeSingle();

const seasonStart = seasonConfig?.value || '2000-01-01';

const { count } = await supabaseAdmin
  .from('fitness_logs')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('activity_type', 'friendly_match')
  .gte('created_at', seasonStart);
```

**Alternative:** Reset count to 0 in the `end-of-season` cron job.

**Files to modify:**
- `app/api/league/friendly/route.ts` — change limit to per-season
- `app/api/cron/end-of-season/route.ts` — reset friendly count

---

## P2: Medium-Priority Fixes

### Fix P2-1: Unify OVR Floor

**Addresses:** L2-5

**Problem:** Age decay uses OVR floor of 1, form decay uses floor of 40. This creates zombie players.

**Proposal:** Use a consistent OVR floor of 40 across all systems.

**Implementation:**

```typescript
// In age-players/route.ts:63, change:
const newOvr = Math.max(1, (player.ovr || 50) - decay);
// To:
const newOvr = Math.max(40, (player.ovr || 50) - decay);
```

**Files to modify:**
- `app/api/cron/age-players/route.ts` — change OVR floor from 1 to 40

---

### Fix P2-2: Add Retirement Probability Curve

**Addresses:** L2-6

**Problem:** Retirement at 35 is a hard cutoff with no randomness.

**Proposal:** Introduce probability-based retirement starting at age 33.

**Implementation:**

```typescript
// In age-players/route.ts, replace line 35:
// OLD: if (newAge >= 35) { retire }
// NEW: probability-based retirement
const retireProbability = newAge >= 35 ? 1.0    // 100% at 35
  : newAge === 34 ? 0.50                         // 50% at 34
  : newAge === 33 ? 0.15                         // 15% at 33
  : 0;

if (Math.random() < retireProbability) {
  // Retire player
}
```

**Key decisions:**
- Age 33: 15% retirement chance
- Age 34: 50% retirement chance
- Age 35+: 100% retirement (guaranteed)
- Creates emergent gameplay around player lifecycles

**Files to modify:**
- `app/api/cron/age-players/route.ts` — add probability curve

---

### Fix P2-3: Connect AI Medical Cost Multiplier

**Addresses:** L3-10

**Problem:** The AI Economy Agent's `medical_cost` multiplier has no effect on healing costs.

**Proposal:** Pass the multiplier to heal functions and apply it.

**Implementation:**

```typescript
// In baseActions.ts:healPlayer(), fetch current multiplier:
const { data: econState } = await supabaseAdmin
  .from('economy_state')
  .select('medical_cost_multiplier')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const medCostMult = econState?.medical_cost_multiplier ?? 1.0;
const discountedCost = Math.floor(spCost * (1 - discount) * medCostMult);
```

**Files to modify:**
- `app/actions/baseActions.ts` — fetch and apply medical_cost_multiplier

---

### Fix P2-4: Fix Admin Heal Column Name

**Addresses:** L2-11

**Problem:** Admin heal uses `injury_duration` instead of `injury_matches_left`.

**Proposal:** Update column name to match current schema.

**Implementation:**

```typescript
// In adminActions.ts:325, change:
.update({ stamina: 100, is_injured: false, injury_duration: 0 })
// To:
.update({ stamina: 100, is_injured: false, injury_matches_left: 0 })
```

**Files to modify:**
- `app/actions/adminActions.ts` — fix column name

---

### Fix P2-5: Form Decay OVR Recalculation Accuracy

**Addresses:** L2-9

**Problem:** Form decay uses stale `pac` value with rough correction.

**Proposal:** Read the updated `pac` value after the update.

**Implementation:**

```sql
-- In apply_form_decay(), change the OVR recalculation:
-- OLD: uses stale pac
-- NEW: use v_new_pac directly
UPDATE players
SET
  stats = stats
    || jsonb_build_object('pac', v_new_pac)
    || jsonb_build_object('phy', v_new_phy),
  ovr = GREATEST(
    40,
    FLOOR((
      v_new_pac  -- use the new value, not stale
      + COALESCE((stats->>'sho')::int, 50)
      + COALESCE((stats->>'pas')::int, 50)
      + COALESCE((stats->>'def')::int, 50)
      + v_new_phy  -- use the new value
    ) / 5.0)
  )
WHERE id = v_record.player_id;
```

**Files to modify:**
- `supabase/migrations/00039_form_decay_and_economy_v2.sql` — fix OVR recalculation

---

## P3: Low-Priority / Technical Debt

### Fix P3-1: Batch `age-players` Cron

**Addresses:** L2-8

**Problem:** `age-players` processes all players individually, risking timeout.

**Proposal:** Rewrite as a single SQL function (like `apply_form_decay()`).

**Implementation:** Create `apply_player_aging()` SQL function that atomically increments age, applies OVR decay, and handles retirement.

---

### Fix P3-2: Clean Up Dead SQL RPCs

**Addresses:** L3-9

**Problem:** Dead RPCs from superseded migrations may confuse developers.

**Proposal:** Drop unused RPCs:
- `regenerate_stamina()` from `00009`
- `convert_training_points()` from `00014`
- `award_match_fancoins()` from `00029`

**Implementation:** Create a migration that drops these functions if they exist.

---

### Fix P3-3: Unify Salary Formula

**Addresses:** L3-9 (indirect)

**Problem:** `00029` created `award_match_fancoins` with different reward formula than TypeScript code.

**Proposal:** Either update the SQL RPC to match TypeScript, or drop it entirely (recommended: drop since TypeScript is the source of truth).

---

## Implementation Priority Matrix

| Fix | Severity | Effort | Dependencies |
|-----|----------|--------|--------------|
| P0-1 (Persist injuries) | CRITICAL | Medium | None |
| P0-2 (Bankruptcy spiral) | HIGH | Low | None |
| P1-1 (MC heal discount) | MEDIUM | Low | None |
| P1-2 (Pitch injury reduction) | MEDIUM | Medium | P0-1 |
| P1-3 (Natural healing) | MEDIUM | Low | P0-1 |
| P1-4 (Friendly reset) | MEDIUM | Low | None |
| P2-1 (OVR floor) | LOW | Trivial | None |
| P2-2 (Retirement curve) | LOW | Low | None |
| P2-3 (AI medical cost) | LOW | Low | P1-1 |
| P2-4 (Admin heal fix) | LOW | Trivial | None |
| P2-5 (Form decay accuracy) | LOW | Low | None |
| P3-1 (Batch aging) | LOW | Medium | None |
| P3-2 (Dead RPCs) | LOW | Trivial | None |

---

## Recommended Implementation Order

1. **P0-1** (Persist injuries) — unblocks P1-2 and P1-3
2. **P0-2** (Bankruptcy spiral) — highest player experience impact
3. **P1-3** (Natural healing) — depends on P0-1
4. **P1-1** (MC heal discount) — quick win
5. **P1-4** (Friendly reset) — quick win
6. **P2-1** (OVR floor) — trivial fix
7. **P2-4** (Admin heal fix) — trivial fix
8. **P1-2** (Pitch injury) — depends on P0-1
9. **P2-2** (Retirement curve) — low priority
10. **P2-3** (AI medical cost) — depends on P1-1
11. **P2-5** (Form decay accuracy) — low priority
12. **P3-1** (Batch aging) — technical debt
13. **P3-2** (Dead RPCs) — technical debt

---

## Testing Strategy

Each fix should be verified with:

1. **Unit tests** for modified functions (salary calc, heal cost, injury persistence)
2. **Integration tests** for match resolution flow (injury → notification → healing)
3. **Manual testing** for UI flows (bankruptcy scenario, injury cascade)
4. **Load testing** for `age-players` batch optimization

---

## Conclusion

The 21 logic holes discovered in this audit range from critical bugs (injuries not persisting) to minor technical debt (dead SQL RPCs). The two P0 fixes — persisting real-match injuries and breaking the bankruptcy death spiral — should be implemented before any production launch. The P1 fixes address missing features that were designed but never implemented, and the P2/P3 fixes improve consistency and code quality.
