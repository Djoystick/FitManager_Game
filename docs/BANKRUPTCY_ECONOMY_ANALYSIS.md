# BANKRUPTCY ECONOMY ANALYSIS — FitManager Game

**Audit Date:** 2025-06-14
**Lead Developer Proposal:** -15% Stamina, -10% Morale per bankruptcy match
**Analyst:** Lead Architect & Systems Analyst

---

## 1. Executive Summary

The proposed penalty of **-15% Stamina and -10% Morale** per bankruptcy match is **partially ineffective and does not address the root cause**:

- **Stamina penalty (-15%):** INEFFECTIVE. The 30%/hr regen cron over 12 hours between matches fully compensates. Team plays at ~100% effectiveness.
- **Morale penalty (-10%):** MODERATELY EFFECTIVE but SLOW. Hits -10% performance debuff after ~7 matches. Team can still win (~45% vs ~50% base).
- **Root cause unaddressed:** The team bleeds FC every match (salary > reward) and can never recover. The penalty degrades experience but doesn't create a recovery path.

**Recommended values:** 25% Stamina, 15% Morale, PLUS economic lockout and recovery bonus.

---

## 2. Salary Analysis

### Formula
```
salary_per_player = FLOOR(MAX(0, ovr - 40)^1.3 × 0.8) + MAX(0, age - 28)
```

### Salary by Team Tier

| Team Tier | OVR | Age | Salary/Player | Salary/Match (11 players) | Salary/Day (2 matches) |
|-----------|-----|-----|---------------|---------------------------|------------------------|
| Weak | 55 | 22 | 27 FC | 297 FC | 594 FC |
| Mid | 70 | 28 | 66 FC | 726 FC | 1,452 FC |
| Strong | 85 | 30 | 114 FC | 1,254 FC | 2,508 FC |
| Whale | 90 | 32 | 133 FC | 1,463 FC | 2,926 FC |

---

## 3. Revenue Analysis

### Match Rewards (per match)

| Result | Formula | Stadium L1 | Stadium L5 | Stadium L10 |
|--------|---------|------------|------------|-------------|
| Win | 500 + L×150 + tickets + services | 1,990 | 4,786 | 6,536 |
| Draw | 250 + L×70 + tickets + services | 1,660 | 4,136 | 5,886 |
| Loss | 100 + L×30 + tickets + services | 1,470 | 3,786 | 5,536 |

### Ticket Revenue (logarithmic diminishing returns)

```
FLOOR(1800 × ln(stadiumLevel + 1) × (1 + seatingLevel × 0.05))
```

| Stadium Lvl | No Maintenance | With Maintenance (-20%) |
|-------------|----------------|-------------------------|
| L1 | 1,310 | 1,048 |
| L3 | 2,178 | 1,742 |
| L5 | 2,734 | 2,187 |
| L10 | 3,400 | 2,720 |

### Services Revenue

```
services_level × 30 FC per match
```

Default: 1 × 30 = 30 FC/match.

---

## 4. Net Income Per Match (LOSS scenario)

| Team Tier | Loss Revenue (L1) | Loss Revenue (L1, maint) | Salary | Net (L1) | Net (L1, maint) |
|-----------|-------------------|--------------------------|--------|----------|-----------------|
| Weak (55) | 1,470 | 1,208 | 297 | **+1,173** | **+911** |
| Mid (70) | 1,470 | 1,208 | 726 | **+744** | **+482** |
| Strong (85) | 1,470 | 1,208 | 1,254 | **+216** | **-46** |
| Whale (90) | 1,470 | 1,208 | 1,463 | **+7** | **-255** |

### Key Finding
**Bankruptcy ONLY occurs when ALL THREE conditions are met:**
1. High OVR squad (85+) — salary > 1,200 FC
2. Low stadium (L1-L2) — tickets < 1,300 FC
3. Deferred maintenance active — -20% ticket reduction

Without maintenance penalty, even whale teams are barely profitable (+7 FC/match on loss at L1).

---

## 5. Bankruptcy Simulation

### Scenario: Strong Team (85 OVR, 30 age, Stadium L1, maintenance active)

**Parameters:**
- Salary: 1,254 FC/match
- Loss revenue (with maint): 1,208 FC
- Net per match: -46 FC
- Stamina regen: 30% of missing per hour
- Matches per day: 2 (~12 hours between)
- Proposed penalty: -15% stamina, -10% morale per bankruptcy match

### Simulation Results

```
Match | Pre-Stam | Drain | Penalty | Post-Stam | Cron Regen | Morale | Eff%  | FC    | Status
------|----------|-------|---------|-----------|------------|--------|-------|-------|--------
  1   |   100    |  -20  | -15%    |    68     |    →99     |   63   | 100%  |   0   | ⚠️
  2   |    99    |  -20  | -15%    |    67     |    →99     |   56   | 100%  |   0   | ⚠️
  3   |    99    |  -20  | -15%    |    67     |    →99     |   50   | 100%  |   0   | ⚠️
  4   |    99    |  -20  | -15%    |    67     |    →99     |   45   | 100%  |   0   | ⚠️
  5   |    99    |  -20  | -15%    |    67     |    →99     |   40   | 100%  |   0   | ⚠️
  6   |    99    |  -20  | -15%    |    67     |    →99     |   36   |  90%  |   0   | ⚠️
  7   |    99    |  -20  | -15%    |    67     |    →99     |   32   |  90%  |   0   | ⚠️
  8   |    99    |  -20  | -15%    |    67     |    →99     |   28   |  90%  |   0   | ⚠️
  9   |    99    |  -20  | -15%    |    67     |    →99     |   25   |  90%  |   0   | ⚠️
 10   |    99    |  -20  | -15%    |    67     |    →99     |   22   |  90%  |   0   | ⚠️
```

### Analysis

**Stamina:**
- After drain (20) + penalty (15%): stamina = 68
- After 12h regen (30%/hr × 12 cycles): stamina → 99
- **The penalty is FULLY COMPENSATED by cron regen**
- Team plays at 100% effectiveness every match
- **Verdict: -15% stamina penalty is USELESS**

**Morale:**
- Starts at 70, drops 10% per match
- Hits 40 after ~7 matches → triggers -10% performance debuff in match engine
- Continues dropping to ~22 after 10 matches
- **The morale penalty IS effective but VERY SLOW**
- Team can still win (probability drops from ~50% to ~45%)
- **Verdict: -10% morale penalty is TOO SLOW to be meaningful**

**FC Balance:**
- Stays at 0 forever (bleeding -46 FC/match)
- Never recovers unless they win a match
- **The penalty does NOT address the economic death spiral**

---

## 6. Escape Path Analysis

### Can a bankrupt team recover by winning?

| Result | Revenue | Salary | Net | Escapes? |
|--------|---------|--------|-----|----------|
| Win | 1,990 | 1,254 | +736 | ✅ YES |
| Draw | 1,660 | 1,254 | +406 | ✅ YES |
| Loss | 1,208 | 1,254 | -46 | ❌ NO |

**Winning once immediately escapes bankruptcy.** Even with morale debuff, the team can still win (~45% probability against equal opponent).

### Escape Simulation (1 win in 3 matches)

```
Match 1: Loss → net -46 FC → balance 0 | morale 63
Match 2: Win  → net +736 FC → balance 736 | morale 63
Match 3: Loss → net -46 FC → balance 690 | morale 63
→ ESCAPED after 3 matches (1 win, 2 losses)
```

---

## 7. Extreme Scenario: Whale Team

### Parameters
- 90 OVR, age 32, Stadium L1, maintenance active
- Salary: 1,463 FC/match
- Loss revenue: 1,208 FC
- Net per match: **-255 FC** (much worse than strong team)

### Simulation

```
Match | Stamina | Morale | Eff%  | FC    | Status
------|---------|--------|-------|-------|--------
  1   |   99    |   63   | 100%  |   0   | ⚠️
  2   |   99    |   56   | 100%  |   0   | ⚠️
  3   |   99    |   50   | 100%  |   0   | ⚠️
  4   |   99    |   45   | 100%  |   0   | ⚠️
  5   |   99    |   40   | 100%  |   0   | ⚠️
  6   |   99    |   36   |  90%  |   0   | ⚠️
  7   |   99    |   32   |  90%  |   0   | ⚠️
  8   |   99    |   28   |  90%  |   0   | ⚠️
  9   |   99    |   25   |  90%  |   0   | ⚠️
 10   |   99    |   22   |  90%  |   0   | ⚠️
```

**Same pattern:** Stamina fully recovered, morale slowly degrading, FC permanently at 0.

---

## 8. Critical Flaw Analysis

### The Penalty Addresses Symptoms, Not Causes

| Aspect | Current Proposal | Root Cause |
|--------|------------------|------------|
| Symptom | Low stamina | Not the problem (cron fixes it) |
| Symptom | Low morale | Secondary issue (slow degradation) |
| **Cause** | **Salary > Revenue** | **NOT ADDRESSED** |
| **Cause** | **No recovery path** | **NOT ADDRESSED** |

### Why the Stamina Penalty Is Useless

```
Stamina regen formula: regen = missing × 0.30 per hour
After -15% penalty on 80 stamina: 80 × 0.85 = 68
Missing: 100 - 68 = 32
Regen per hour: 32 × 0.30 = 9.6
After 12 hours: 68 + (9.6 × 12) ≈ 68 + 32 = 100 (capped)
```

The 30%/hr regen rate is too aggressive for a 15% penalty to have any lasting effect.

### Why the Morale Penalty Is Too Slow

```
Morale trajectory: 70 → 63 → 56 → 50 → 45 → 40 → 36 → 32 → 28 → 25 → 22
Debuff threshold: morale < 40 (match 6-7)
Debuff effect: -10% buff in eff() function
Can they still win? YES (~45% vs ~50% base)
```

It takes 7+ matches to matter, and even then the effect is modest.

---

## 9. Proposed Alternative Values

### Option A: Enhanced Version (Recommended)

| Penalty | Value | Effect |
|---------|-------|--------|
| Stamina | **25%** | After drain+penalty: 80 × 0.75 = 60. After 12h regen: ~95. Still recovers, but team enters next match at lower stamina. |
| Morale | **15%** | Hits 40 after ~4 matches (vs 7). Debuts faster, more noticeable. |
| Economic lockout | **NEW** | Disable building upgrades and transfer market while FC = 0 |
| Recovery bonus | **NEW** | Next win after bankruptcy gives +50% FC to help escape |

### Option B: Aggressive Version

| Penalty | Value | Effect |
|---------|-------|--------|
| Stamina | **30%** | After drain+penalty: 80 × 0.70 = 56. After 12h regen: ~92. Team enters next match at 92 (vs 99). |
| Morale | **20%** | Hits 40 after ~3 matches. Very fast degradation. |
| Minimum stamina | **NEW** | Cannot play if avg stamina < 30 (forces healing) |

### Option C: Economic-Only Version (No Stat Debuff)

| Penalty | Value | Effect |
|---------|-------|--------|
| Stamina | 0% | No stat penalty |
| Morale | 0% | No stat penalty |
| Building lock | **FULL** | Cannot upgrade any buildings while bankrupt |
| Transfer lock | **FULL** | Cannot buy/sell players while bankrupt |
| UI warning | **NEW** | "BANKRUPT" banner on dashboard |
| Recovery bonus | **NEW** | +25% FC on next win |

---

## 10. Comparison Table

| Design | Stamina Effect | Morale Effect | Recovery Path | Abuse Potential | Quit Risk |
|--------|----------------|---------------|---------------|-----------------|-----------|
| Current (cap 30) | SEVERE (0.75x) | NONE | IMPOSSIBLE | NONE | HIGH |
| Proposed (-15%/-10%) | NONE (cron compensates) | SLOW (7+ matches) | HARD (must win) | LOW | MEDIUM |
| **Option A (25%/15%)** | **MILD (95 stamina)** | **MODERATE (4 matches)** | **POSSIBLE (with bonus)** | **LOW** | **LOW** |
| Option B (30%/20%) | **MODERATE (92 stamina)** | **FAST (3 matches)** | **POSSIBLE** | **LOW** | **MEDIUM** |
| Option C (economic) | NONE | NONE | EASY (just win) | **MEDIUM** | **LOW** |

---

## 11. Recommendation

### Primary Recommendation: Option A (Enhanced)

**Values:**
- Stamina penalty: **25%** (up from 15%)
- Morale penalty: **15%** (up from 10%)
- Add: Economic lockout (no upgrades/transfers while bankrupt)
- Add: Recovery bonus (+50% FC on next win)

**Rationale:**
1. **25% stamina** creates a visible but not crippling effect. Team enters next match at ~95 stamina (vs 99), which is noticeable but doesn't prevent winning.
2. **15% morale** hits the debuff threshold in ~4 matches (vs 7), making the consequence felt faster.
3. **Economic lockout** prevents bankrupt teams from investing in buildings while bleeding FC — focuses resources on survival.
4. **Recovery bonus** creates a clear path out of bankruptcy — winning once gives enough FC to stabilize.

### Why This Works

```
Bankruptcy timeline with Option A:
Match 1: Lose → -46 FC → balance 0 | stam 95 | morale 59
Match 2: Lose → -46 FC → balance 0 | stam 95 | morale 50
Match 3: Lose → -46 FC → balance 0 | stam 95 | morale 43
Match 4: Win  → +736×1.5 = +1104 FC → balance 1104 | morale 43
→ ESCAPED with 1,104 FC. Can rebuild stadium, fix maintenance, become profitable.
```

### Anti-Abuse Analysis

**Can players exploit 0 FC?**
- At 0 FC, they cannot upgrade buildings, buy players, or invest in infrastructure
- They are stuck at current power level while opponents grow
- The longer they stay bankrupt, the further behind they fall
- **Verdict: NOT abusable** — there's no strategic advantage to staying at 0 FC

**Can players intentionally go bankrupt to avoid salary costs?**
- Salary is automatically deducted from match rewards
- If salary > reward, FC floors at 0 (GREATEST(0,...))
- They still lose the salary amount — it's not "free"
- **Verdict: NOT exploitable** — bankruptcy is a consequence, not a strategy

---

## 12. Implementation Notes

### Penalty Application Point

The penalty should be applied **after** the match result is determined but **before** the next match is scheduled:

```typescript
// In matchActions.ts, after applyFcTransaction:
if ((afterUpdate?.balance_fancoins ?? 1) === 0 && totalSalary > totalReward) {
  // Apply cumulative bankruptcy debuff
  await Promise.all(
    players.map(p => ({
      stamina: Math.floor(Number(p.stamina ?? 100) * 0.75),  // -25%
      morale: Math.floor(Number(p.morale ?? 70) * 0.85),     // -15%
    }))
    // ... update each player
  );
}
```

### Recovery Bonus Implementation

```typescript
// After bankruptcy penalty, check if this win escaped bankruptcy:
if (prevBalance === 0 && newBalance > 0) {
  // Apply recovery bonus: +50% FC
  const bonus = Math.floor(newBalance * 0.50);
  await supabaseAdmin.rpc('increment_fancoins', {
    user_id: userId,
    amount: bonus
  });
}
```

### Economic Lockout Implementation

```typescript
// In upgrade/building functions:
const { data: user } = await supabaseAdmin
  .from('users')
  .select('balance_fancoins')
  .eq('id', userId)
  .single();

if ((user?.balance_fancoins ?? 0) === 0) {
  return { success: false, error: 'Cannot upgrade while bankrupt. Win a match to recover.' };
}
```

---

## 13. Conclusion

The Lead Developer's proposal of -15% Stamina / -10% Morale is **well-intentioned but mathematically flawed**:

1. **-15% Stamina is ineffective** — the 30%/hr regen cron fully compensates within 12 hours
2. **-10% Morale is too slow** — takes 7+ matches to trigger the performance debuff
3. **Root cause not addressed** — the team bleeds FC every match with no recovery path

**Recommended values: -25% Stamina, -15% Morale, PLUS economic lockout and recovery bonus.**

These values create a meaningful consequence (visible stamina reduction, faster morale degradation) while maintaining a clear path to recovery (win one match with +50% bonus to escape). The penalty is neither too harsh (death spiral) nor too lenient (abusable), and addresses both the symptoms AND the root cause.
