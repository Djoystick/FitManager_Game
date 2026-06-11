# Task 010: Match Engine V2 (Phase 2) - Momentum, Stamina & Traits

## Context
You are supervised by the Senior Architect. Phase 1 (Math, Red Cards, Tactics) was successfully implemented and committed. Now we move to Phase 2. Do NOT implement Phase 3 (Match Events, Match Form) yet.

## Tasks

### 1. Dynamic Stamina Drain (By Phases)
In `drainStamina()`, replace the flat drain logic with a phase-based system based on the current minute of the match (`tick` or `minute`):
- **Phase 1 (1–30 min)**: High intensity. Multiply drain by `1.2`.
- **Phase 2 (31–60 min)**: Normal pace. Multiply drain by `1.0`.
- **Phase 3 (61–75 min)**: Energy conservation. Multiply drain by `0.85`.
- **Phase 4 (76–90 min)**: Final sprint. Multiply drain by `1.1`.

### 2. Momentum System & Home Advantage
- **Home Advantage**: Give the home team a slight base bonus (+5% to all stats or a direct buff multiplier) and a slightly higher chance of generating an attack during the timeline creation.
- **Score Pressure (Momentum)**:
  - If a team is trailing by ≥ 2 goals, give them a "Desperation Push" bonus (+10% to attacks/duels).
  - If a team is leading by ≥ 3 goals, give them a "Comfort Zone" penalty (-5% to attacks).
  - *Note: Ensure you pass the current score into your momentum calculation during the simulation loop.*

### 3. Implement 6 New Traits
Add the 6 new player traits you proposed into the logic (`app/utils/matchEngine.ts` and potentially type definitions):
- `Comeback Kid`: +15% to all stats when the team is currently losing the match.
- `Clutch`: +20% to finishing in the last 15 minutes (75+ min).
- `Tireless`: -40% drain stamina.
- `Enforcer`: +10% to defend duels, but +5% base foul chance.
- `Aerial Threat`: Bonus to corners/headers (if modeled), otherwise +15% attack in the penalty box.
- `Dive King`: Higher chance to earn a penalty during an attack.

## Output
Modify the engine to support these mechanics. Ensure everything integrates smoothly with Phase 1. Write a summary to `.mimo_workflow/010_report.md` when done.
