# Task 010 Report: Match Engine V4.1 — Phase 2 Implementation

## Changes Implemented

### 1. Dynamic Stamina Drain (By Phases)

New helper `getPhaseDrainMultiplier(minute)` returns phase-specific multipliers:
- Phase 1 (1–30 min): ×1.20 — high intensity start
- Phase 2 (31–60 min): ×1.00 — normal pace
- Phase 3 (61–75 min): ×0.85 — energy conservation
- Phase 4 (76–90 min): ×1.10 — final sprint

`drainStamina()` now accepts optional `minute` parameter (default: 1). Phase multiplier is applied to the base drain before position/pressing modifiers.

**New trait: Tireless** — -40% drain stamina (stacks multiplicatively with Engine's -30%).

### 2. Momentum System & Home Advantage

**Home Advantage:**
- Home team gets ×1.05 bonus to midfield score (+5% possession edge)
- Home team gets +1 attack in the timeline
- Applied consistently to possession calculation and attack count

**Score Pressure (Momentum):**
- Trailing by ≥2 goals: "Desperation Push" → ×1.10 attack bonus for trailing team
- Leading by ≥3 goals: "Comfort Zone" → ×0.95 attack penalty for leading team
- Defending team trailing by ≥2: ×1.05 defense bonus (desperate defending)
- Bonuses applied to all 3 attack phases: Build-up, Penetration, Finishing

### 3. Six New Traits

| Trait | Effect | Where Applied |
|-------|--------|---------------|
| **Comeback Kid** | +15% to all stats when team is losing | Penetration (atk & def), Finishing |
| **Clutch** | +20% finishing in last 15 min (75+) | Finishing phase |
| **Tireless** | -40% stamina drain | `drainStamina()` |
| **Enforcer** | +10% defend duels, +5% foul chance | Penetration (def), foul roll |
| **Aerial Threat** | +25% header effectiveness | Corner kicks |
| **Dive King** | +5% penalty conversion (higher bias) | Penalty kicks |

### Integration Notes
- All traits integrate with existing `traits: string[]` array on `MatchPlayer`
- No database schema changes needed
- Backward compatible: existing players without new traits are unaffected
- `AttackContext` extended with `momentumAtkBonus` and `momentumDefBonus` fields

## Files Modified
- `app/utils/matchEngine.ts` — all changes (v4.0 → v4.1)

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing types preserved; new fields are additive
- Backward compatible with Phase 1 code
