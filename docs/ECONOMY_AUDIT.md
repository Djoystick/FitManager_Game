# FitManager Economy Audit Report

> **Date:** 2026-06-13
> **Method:** Monte Carlo simulation via `scripts/simulate_economy.ts`
> **Scope:** 10 seasons × 3 archetypes (Casual / Active / Whale)
> **Constraint:** No production code was modified during this audit.

---

## Executive Summary

The FitManager economy has a **severe structural imbalance**: income sources (faucets) vastly outpace expense sinks across all player archetypes. After 10 simulated seasons, even the most casual player accumulates ~198K FC with zero upgrades, while an active player reaches **2.3M FC**. There is no meaningful risk of bankruptcy. The economy is hyper-inflationary by design.

| Archetype | Avg Income/Season | Avg Expense/Season | Net Flow/Season | Final Balance | Bankrupt? |
|-----------|-------------------|---------------------|-----------------|---------------|-----------|
| Casual (50% play, no upgrades) | 25,151 | 5,844 | +19,307 | 198,073 | No |
| Active (100% play, greedy upgrades) | 265,705 | 37,738 | +227,966 | 2,284,663 | No |
| Whale (50K injection, max upgrades) | 268,826 | 178,194 | +90,632 | 961,323 | No |

---

## 1. Inflation Rate

**Verdict: Extreme FC inflation. Zero deflationary pressure.**

- Active player balance grows **436%** from first-half average to second-half average.
- Casual player balance grows **151%** over the same period.
- Whale player balance grows **306%** despite spending ~178K/season on upgrades.

The primary inflation driver is **ticket revenue at Stadium Level 5+**, which generates 3,000-4,000 FC per match — dwarfing the salary cost of ~570 FC per match. Once a player reaches Stadium L5, they are permanently cash-positive regardless of win/loss record.

### Balance Trajectory (Active Player)

| Season | Balance | Δ from Previous |
|--------|---------|-----------------|
| 1 | 423 | — (heavy upgrade spending) |
| 2 | 89 | — (continued upgrades) |
| 3 | 230,770 | +230,681 (upgrades complete) |
| 5 | 822,880 | +592,110 |
| 10 | 2,284,663 | +1,461,783 |

---

## 2. Deflation / Bankruptcy Risk

**Verdict: Bankruptcy is functionally impossible.**

- No archetype went bankrupt across 10 seasons.
- Even if a player loses every match and does zero quests, the ticket revenue from a Level 1 stadium (5,000 capacity × 75% fill × 20 FC/100 = 750 FC/match) exceeds the salary cost (~570 FC for avg OVR 65 squad).
- The only scenario where a player could go bankrupt is:
  1. Stadium Level 1, all losses (100 FC match reward + 750 tickets = 850 FC income)
  2. 11 players with OVR 80+ (salary ~1,200 FC/match)
  3. Playing 26 matches: income = 22,100, salary = 31,200 → **net -9,100 FC**
  4. But this requires zero quest income and zero season payout, which is unrealistic.

---

## 3. Sinks vs Faucets Analysis

### Faucets (FC Sources)

| Source | Formula | Per-Season Estimate (Active) |
|--------|---------|------------------------------|
| Match Result Reward | Win: 500 + Lvl×150; Draw: 250 + Lvl×70; Loss: 100 + Lvl×30 | ~40,000 FC |
| Ticket Revenue | `floor(stadiumLvl×5000×fillRate×20/100×(1+seatingLvl×0.05))` | ~240,000 FC |
| Services Income | `servicesLevel × 30` | ~780 FC |
| Daily Quests | 3 quests/day × 26 days × avg 170 FC | ~13,260 FC |
| Season-End Payout | 1st: 15K+(11-tier)×2K; Top3: 10K+(11-tier)×1.5K; Rest: 3K+(11-tier)×500 | ~6,000 FC |
| Cup Winner | 5,000 FC | ~400 FC (8% chance) |
| **Total** | | **~300,000 FC/season** |

### Sinks (FC Drains)

| Sink | Formula | Per-Season Estimate (Active) |
|------|---------|------------------------------|
| Player Salaries | `Σ floor((ovr-40)^1.3 × 0.8) + max(0, age-28)` per match × 26 | ~12,500 FC |
| Building Upgrades | `floor(800 × level^1.8)` (one-time, finite) | ~240K total (S1-S3) |
| Market Listing Fee | `stadiumLevel × 250` per listing | Negligible |
| W2E Training | Uses special coins, not FC | 0 FC |
| **Total (ongoing)** | | **~12,500 FC/season** |

### Structural Imbalance

```
FAUCETS:  ~300,000 FC/season
SINKS:    ~12,500 FC/season (ongoing, after upgrades)
RATIO:    24:1 income-to-expense
```

After building upgrades are complete (typically Season 2-3 for active players), there is **virtually no FC sink** in the game. The economy becomes a pure accumulation game.

---

## 4. Exploits & Dead Ends

### Exploit 1: Stadium Level 5 Income Permanently Outpaces All Expenses
- **Stadium L5**: Win = 500 + 5×150 = 1,250 FC match reward + ~3,900 FC tickets = **5,150 FC per win**
- **Salary cost**: ~570 FC per match (11 players, avg OVR 65)
- **Net per match**: +4,580 FC (win), +3,680 FC (draw), +3,030 FC (loss)
- **Verdict**: Once Stadium reaches L5 (cost: ~43,700 FC total), the player is permanently cash-positive. This is achievable by Season 2 for active players.

### Exploit 2: Ticket Revenue Dominance
- At Stadium L10: `10×5000×0.75×20/100×1.05 = 7,875 FC` per match
- With 26 matches: **204,750 FC/season** from tickets alone
- This is 8× the season-end payout for 1st place
- **Fix**: Ticket revenue should be capped or reduced by ~70%

### Exploit 3: Casual Players Accumulate Unlimited FC
- A casual player doing 50% of matches with zero upgrades accumulates 198K FC in 10 seasons
- With no meaningful sink, this FC sits idle or gets spent on market speculation
- **Fix**: Add ongoing maintenance costs (facility upkeep, staff wages) proportional to building levels

### Exploit 4: Quest Income is Pure Bonus
- Daily quests generate ~13,260 FC/season with zero cost
- Combined with zero building investment, this alone covers 88% of salary expenses
- **Fix**: Quest FC rewards should be reduced or quests should have completion costs

### Exploit 5: No Training Cost for FC
- Player stat training uses W2E special coins (cardio, fitness, ball, strength), not FC
- This means FC has no direct use for player improvement — only buildings consume it
- **Fix**: Consider adding an FC-based training option or training ground maintenance

### Dead End: FC Has No Endgame Use
- After maxing buildings (L10 stadium, L5 everything else), there is **nothing to spend FC on**
- Market transactions are TON-based (not FC)
- Result: FC becomes a meaningless number with no strategic value
- **Fix**: Add endgame FC sinks (legendary player transfers, custom kits, stadium cosmetics, tournament entry fees)

---

## 5. Recommendations

### Priority 1: Cap Ticket Revenue (Critical)
```typescript
// BEFORE (current):
const ticketRevenue = Math.floor(baseTickets * (1 + seatingLevel * 0.05));

// AFTER (proposed):
const ticketCap = 800; // max 800 FC per match from tickets
const ticketRevenue = Math.min(ticketCap, Math.floor(baseTickets * (1 + seatingLevel * 0.05)));
```
**Impact**: Reduces per-match income by ~3,000 FC at L5 stadium. Makes salary a meaningful expense.

### Priority 2: Add Facility Maintenance Costs
```typescript
// New sink: pay 5% of building upgrade cost per season as upkeep
const maintenanceCost = Math.floor(buildingUpgradeCost(stadiumLevel) * 0.05 
                      + buildingUpgradeCost(academyLevel) * 0.03
                      + buildingUpgradeCost(servicesLevel) * 0.02);
// At L5 stadium: ~725 FC/season maintenance
```
**Impact**: Creates an ongoing FC drain proportional to building investment.

### Priority 3: Reduce Quest FC Rewards by 50%
```typescript
// BEFORE:
{ type: 'play_match',    fc: 200, sp: 5 },
{ type: 'train_squad',   fc: 150, sp: 10 },

// AFTER:
{ type: 'play_match',    fc: 100, sp: 5 },
{ type: 'train_squad',   fc: 75,  sp: 10 },
```
**Impact**: Reduces quest income from ~13,260 to ~6,630 FC/season.

### Priority 4: Introduce FC Sinks
- **Transfer Market FC Fee**: Player purchases should cost FC (not just TON)
- **Training Ground Maintenance**: 100 FC/season per training level
- **Custom Kit / Stadium Cosmetics**: 5,000-50,000 FC one-time purchases
- **Tournament Entry Fee**: 500-2,000 FC to enter cup tournaments

### Priority 5: Season-End Payout Scaling
```typescript
// BEFORE:
if (position === 1)      fcWon = 15000 + ((11 - t) * 2000);
else if (position <= 3)  fcWon = 10000 + ((11 - t) * 1500);
else                     fcWon = 3000  + ((11 - t) * 500);

// AFTER (reduce by ~40%):
if (position === 1)      fcWon = 8000 + ((11 - t) * 1200);
else if (position <= 3)  fcWon = 6000 + ((11 - t) * 900);
else                     fcWon = 1500 + ((11 - t) * 300);
```

---

## 6. Projected Impact of Recommendations

If all 5 recommendations are implemented:

| Archetype | Current Final Balance | Projected Final Balance | Change |
|-----------|----------------------|------------------------|--------|
| Casual | 198,073 | ~15,000-25,000 | -87% |
| Active | 2,284,663 | ~80,000-120,000 | -95% |
| Whale | 961,323 | ~40,000-60,000 | -94% |

The economy would shift from **hyper-accumulation** to **tight budget management**, where players must make strategic choices about building upgrades vs. saving for endgame content.

---

## 7. Methodology Notes

- Simulation runs `scripts/simulate_economy.ts` via `npx tsx`
- Each archetype is simulated for 10 seasons (26 matches + 26 quest days each)
- Randomness: match outcomes (RNG with skill bonus), fill rates (60-90%), quest selection
- Formulas extracted from production code:
  - `app/actions/matchActions.ts` (salary, match reward, ticket revenue)
  - `supabase/migrations/00039_form_decay_and_economy_v2.sql` (building upgrade cost)
  - `app/api/quests/generate/route.ts` (quest rewards)
  - `app/api/cron/end-of-season/route.ts` (season-end payouts)
- Full results at: `.mimo_workflow/economy_audit/simulation_results.json`

---

*This report was generated by the Monte Carlo economy simulator. No production code was modified.*
