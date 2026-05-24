# Report: Player Training System

## 1. Economy & Discount Formula
The Training System relies on a dynamic economy where upgrading player stats costs FanCoins. To give the `training_camp` infrastructure building tangible value, a discount formula is applied.

**Base Cost:** 500 FanCoins per +1 stat point.
**Discount Formula:** `Math.min(0.50, training_camp_level * 0.05)`

- This grants a **5% discount per level** of the Training Camp.
- The discount is strictly capped at **50%** (reached at level 10) to prevent the economy from breaking at extremely high levels.
- **Example Calculation:** 
  - Level 4 Training Camp = 20% discount.
  - `500 * (1 - 0.20) = 400 FanCoins` per stat upgrade.

## 2. JSONB Stat Increment Logic
Because the 5 core granular stats (`pace`, `shooting`, `passing`, `defending`, `physical`) are stored inside a single `stats` JSONB column in the Postgres database, we execute the update by merging the payload securely on the backend before the `update` query.

### Execution Flow:
1. **Fetch:** Retrieve the current `player.stats` JSONB object from the database.
2. **Spread & Increment:** 
   ```typescript
   const currentStats = player.stats;
   const newStats = {
     ...currentStats,
     [statKey]: currentStats[statKey] + 1
   };
   ```
   By using the JS spread operator `...currentStats`, we guarantee that the other un-targeted stats inside the object are not accidentally overwritten or deleted during the update.
3. **Recalculate OVR:** The overarching `ovr` integer column is immediately recalculated by averaging the 5 properties of the newly mutated `newStats` object.
4. **Update:** We push both the mutated `newStats` JSONB object and the `newOvr` integer to the database in a single transaction.

## 3. Potential Limit Constraint
Before any deduction or update occurs, the engine explicitly validates:
`if (player.ovr >= player.potential_limit)`
If true, the training is blocked. This ensures that procedurally generated low-tier players cannot be infinitely upgraded into superstars, preserving the need to eventually hit the Transfer Market for higher potential recruits.
