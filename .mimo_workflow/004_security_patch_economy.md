# Task 004: Security Patch - Phase 4 (Economy Engine & Match Logic)

## Context
You are supervised by the Senior Architect. This phase focuses on fixing logic bugs that disrupt the game economy and match realism.

## STRICT RULES OF ENGAGEMENT
1. **DO NOT** modify UI, CSS, or Database Migrations.
2. **DO NOT** delete any files.
3. **ONLY** modify the specified files.

## Tasks
Your goal is to fix vulnerabilities C12, C15, and C17.

### 1. Match Engine: 99 Goal Cap (C15)
**File**: `app/utils/matchEngine.ts`
- **Bug**: A team with a 20+ OVR advantage can score up to 99 goals, creating absurd results.
- **Fix**: Change the cap for `ovrDiff >= 20` from 99 down to 8 maximum goals.

### 2. Economy AI: Missing Validation (C17)
**File**: `app/api/cron/economy-agent/route.ts`
- **Bug**: The AI response is parsed and inserted directly. A hallucination could set a multiplier to 0.001 or 99.9, breaking the economy.
- **Fix**: Create a helper `clamp` function and apply it to the AI multipliers before inserting into the DB:
  - `match_reward_multiplier` should be clamped between 0.7 and 1.3
  - `medical_cost_multiplier` should be clamped between 0.5 and 2.0
  - `training_cost_multiplier` should be clamped between 0.8 and 1.5

### 3. Training Cost Discrepancy (C12)
**File**: `app/actions/trainingActions.ts`
- **Bug**: The `batchTrainPlayerAction` uses a different cost scale than the individual RPC, allowing players to spam individual RPCs for massive discounts.
- **Fix**: Adjust the `costs` array/logic in `batchTrainPlayerAction` so it strictly aligns with the RPC scale:
  - Increment 1-5: 5 FC
  - Increment 6-10: 10 FC
  - Increment 11-15: 25 FC
  - Increment 16-20: 60 FC
  - Increment 21-25: 120 FC
  - Increment 26+: 300 FC
*(Note: Implement this cost logic mathematically or by updating the hardcoded arrays so that the total cost of batch training matches doing it manually).*

## Output
When finished, write a short summary of your fixes in `.mimo_workflow/004_report.md`.
