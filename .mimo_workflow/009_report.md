# Task 009 Report: Match Engine V4.0 — Phase 1 Implementation

## Changes Implemented

### 1. Mathematics Fixes (P0)

**Stamina Interpolation** (`staminaMult()`):
- Replaced 5-step cliff function with smooth piecewise linear interpolation
- Zones: [75–100]=1.0, [30–75] linear 1.0→0.75, [0–30] steep 0.75→0.55
- No more sudden 5% jumps at boundaries (75→74 is now a gentle slope)

**Possession Normalization** (`midfieldScore()`):
- Added `/ pool.length` division so score represents average quality, not total sum
- A team with 5 weak MIDs no longer automatically dominates possession over 3 strong ones

**Attack Jitter**:
- Increased from `Math.random() * 2 - 1` (±1) to `Math.random() * 4 - 2` (±2)
- Possession multiplier increased from ×7 to ×8
- More variance in match pacing between similar-strength teams

### 2. Cards Logic

**2 Yellows = Red Card**:
- Added `yellowCards` Map<string, number> tracking yellows per player across the match
- On second yellow: fires `second_yellow` event type, player is sent off
- Sent-off player is removed from pitch; auto-sub attempted if bench has matching position

**Yellow Card Aggression Penalty**:
- Player with a yellow card gets -15% to defending stat in penetration duels
- Models fear of receiving second yellow → less aggressive tackles

**Red Card Impact**:
- Track `homeRedCards`/`awayRedCards` counters
- When defending team has a red card, attacking team gets +8% attack bonus AND defending team gets -8% defense penalty
- Sent-off player removed from pitch; auto-sub attempted

### 3. Tactical Styles

**New type**: `TacticalStyle` exported as `'Tiki-Taka' | 'Counter Attack' | 'High Press' | 'Park the Bus' | 'Wing Play' | 'Balanced'`

**simulateMatch signature** now accepts optional `homeTactic` and `awayTactic` parameters (default: `'Balanced'`) — fully backward compatible.

**Tactical bonuses applied**:

| Tactic | Possession | Attacks |
|--------|-----------|---------|
| Tiki-Taka | +15% | -1 |
| Counter Attack | -10% | +2 |
| High Press | +5% | +1 |
| Park the Bus | -15% | -2 |
| Wing Play | +5% | 0 |
| Balanced | 0 | 0 |

- Possession is clamped to [15%, 85%] after tactical modifiers
- Kickoff event now displays both teams' tactical choices

## Files Modified
- `app/utils/matchEngine.ts` — all changes (v3.0 → v4.0)

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing types preserved; new types are additive
- Backward compatible: existing callers of `simulateMatch()` work without changes
