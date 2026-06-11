# Task 011 Report: Match Engine V5.0 — Phase 3 (Final) Implementation

## Changes Implemented

### 1. New Match Events (Dramatic RNG)

**Offside** (~10% after successful penetration):
- Fires `offside` event, attack is nullified (returns early)
- Adds realism: not every breakthrough leads to a shot

**Crossbar / Post** (~5% during finishing):
- Fires `crossbar` event, dramatic miss
- Occurs when finishing duel is lost — high-tension moment

**Own Goal** (~2% when defending team has avg defending < 40):
- Fires `own_goal` event, goal credited to attacking team
- Only triggers under pressure with weak defense — rare but dramatic

**Penalty Save** (~35% base, adjusted by GK quality):
- Replaced old generic "save" on penalties with dedicated `penalty_save` event
- GK defending stat modifies save chance (±0.2% per point above/below 50)
- Range: 20%–50% save chance based on GK quality

**Last-minute Goal** (85+ min, losing by exactly 1 goal):
- x1.5 multiplier to finishing shot value
- Creates dramatic comeback opportunities in final minutes

### 2. Match Form (Streak Modifiers)

New optional parameters on `simulateMatch()`:
- `homeForm: string[]` — e.g., `['W', 'W', 'L']`
- `awayForm: string[]` — e.g., `['L', 'L', 'L']`

**Form bonuses** (based on last 3 matches):
- W-W-W: +5% Confidence Boost to midfield score and attack count
- L-L-L: -5% Tilt penalty to midfield score and attack count
- Other combinations: no modifier
- Defaults to empty array (no bonus) — handles start of season gracefully

Applied to:
- Midfield possession calculation
- Attack count calculation (±0.5 attacks)

### 3. Timeline Pacing Redesign

Replaced uniform random shuffle with weighted minute distribution:

| Zone | Minutes | Weight | Effect |
|------|---------|--------|--------|
| Front-load | 2–15 | ×1.5 | More attacks early (high energy) |
| Mid-game dip | 30–60 | ×0.7 | Quieter middle period |
| Back-load | 75–88 | ×1.5 | More attacks late (final pushes) |
| Normal | 16–29, 61–74 | ×1.0 | Baseline density |

Uses weighted sampling without replacement — preserves randomness while creating realistic pacing patterns.

### Integration Notes
- All changes backward compatible (form params default to `[]`)
- No database schema changes needed
- New event types added to `MatchEvent` union type
- `MatchResult` interface unchanged

## Files Modified
- `app/utils/matchEngine.ts` — all changes (v4.1 → v5.0)

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing types preserved; new fields are additive
- Backward compatible with Phase 1 and Phase 2 code
