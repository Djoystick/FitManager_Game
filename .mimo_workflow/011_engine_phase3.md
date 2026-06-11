# Task 011: Match Engine V2 (Phase 3) - Match Events & Timeline Pacing

## Context
You are supervised by the Senior Architect. Phase 1 and Phase 2 have been successfully implemented and safely committed to the repository. This is the final phase of the Match Engine V2 upgrade.

## Tasks

### 1. New Match Events (Dramatic RNG)
In the simulation loop or event generator, add logic for the new events you proposed in your report:
- **Offside**: ~10% chance during a successful penetration phase. The attack is nullified.
- **Crossbar / Post**: ~5% chance during the finishing phase. A dramatic miss.
- **Own Goal**: ~2% chance when a team has very low defending stats under pressure.
- **Penalty Save**: ~35% base chance for a goalkeeper to save a penalty (generate an event indicating the GK guessed the right way).
- **Last-minute Goal**: A dramatic modifier. If it is 85+ mins and a team is losing by 1 goal, apply a `x1.5` multiplier to their finishing chance for maximum drama.

### 2. Match Form (Streak Modifiers)
- We need a way to optionally accept a `homeForm` and `awayForm` parameter (e.g., as arrays like `['W','W','L']` or numbers representing recent form) into `simulateMatch()`.
- If the last 3 matches were all wins (`W-W-W`), grant a `+5%` Confidence Boost to all stats.
- If the last 3 matches were all losses (`L-L-L`), apply a `-5%` Tilt penalty to all stats.
- Ensure the types and defaults handle cases where form history is missing (e.g., start of the season).

### 3. Redesign Timeline Pacing
In `buildTimeline()`, stop completely shuffling minutes randomly. Make the distribution more realistic:
- Front-load some attacks in the first 15 minutes (high energy).
- Increase density in the last 15 minutes (final pushes).
- Maintain some randomness so it's not entirely predictable, but remove the completely uniform `Math.random()` approach.

## Output
Modify `app/utils/matchEngine.ts` (and types/actions if necessary) to finalize the V2 Engine. Run `npx tsc --noEmit` to ensure type safety. Write a summary to `.mimo_workflow/011_report.md` when done.
