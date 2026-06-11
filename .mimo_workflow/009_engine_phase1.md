# Task 009: Match Engine V2 (Phase 1) - Core Math & Tactics

## Context
You are supervised by the Senior Architect. We have reviewed your excellent 250-line analysis report (Task 008) and approved your findings. However, to avoid breaking the simulation, we are implementing your proposed changes in 3 safe phases. 

You must **ONLY** implement the items listed in this Phase 1 document inside `app/utils/matchEngine.ts`. Do NOT add Phase 2 or Phase 3 features (Momentum, Events, Traits) yet.

## Tasks

### 1. Fix Mathematics (P0)
- **Possession Normalization**: In `midfieldScore`, you noted that a team with 5 MIDs gets too much score. Fix this by normalizing the score (e.g., dividing by `mids.length` or using a scaling factor) so possession is determined by midfield *quality*, not just *quantity*.
- **Stamina Interpolation**: In `staminaMult()`, replace the unrealistic step function (`if (s >= 75) return 1.0; if (s >= 50) return 0.95;`) with a smooth linear or curve interpolation so a stamina drop from 75 to 74 doesn't trigger a sudden 5% efficiency drop.
- **Attack Jitter**: Increase the `jitter` in the total attacks formula as you suggested in your report, so there is more variance in match pacing.

### 2. Cards Logic
- Modify the engine to track yellow cards properly. **2 Yellows = 1 Red Card** (the player must be sent off).
- **Yellow Card Penalty**: A player with a yellow card should receive an aggression penalty (e.g., -15% aggression) because they are afraid of getting a second yellow.
- **Red Card Impact**: If a team gets a red card, the opposing team should receive a noticeable bonus to their attacks/possession.

### 3. Implement Tactical Styles (The Game Changer)
Implement the 6 Tactical Styles you proposed in your report: `Tiki-Taka`, `Counter Attack`, `High Press`, `Park the Bus`, `Wing Play`, and `Balanced`.
- Add a mechanism (e.g., a type definition or parameter) to accept a `tactic` string for `homeTeam` and `awayTeam` in `simulateMatch`.
- Apply the specific bonuses and penalties you outlined for each tactic (e.g., Tiki-Taka gives possession but loses an attack, Park the Bus gives huge defense but loses attacks, etc.).

## Output
Modify `app/utils/matchEngine.ts` to implement these Phase 1 changes. Ensure the code compiles and does not break existing types. Write a brief summary to `.mimo_workflow/009_report.md` when done.
