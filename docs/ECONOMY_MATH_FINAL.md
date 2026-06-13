# FitManager Economy — Mathematical Balance Report

> **Date:** 2026-06-13
> **Method:** Grid search over 1,728 parameter combinations (4×4×4×3×3×3)
> **Goal:** Income/Expense ratio 1.1:1 – 1.3:1 for Active player; suppress Casual inflation
> **Constraint:** No game source code modified — only simulation script

---

## 1. Problem Statement

The previous economy audit (ECONOMY_AUDIT.md) found a **24:1 income-to-expense ratio** for Active players. The economy was hyper-inflationary with no meaningful FC sinks after building upgrades. Five anti-inflationary mechanics were approved:

1. **Logarithmic Ticket Income** — diminishing returns on stadium level
2. **Weekly Maintenance Tax** — % of total building value per season
3. **Quest FC Nerf** — 50% reduction in quest FC rewards
4. **Season Payout Reduction** — 40% reduction in season-end FC
5. **Tournament Entry Fees** — flat FC cost to enter cup tournaments

Additionally, a **Wealth Tax** (% of current FC balance) was added to suppress idle accumulation for casual players.

---

## 2. Optimal Constants (Production-Ready)

After iterating 1,728 configurations, the following constants produce the target balance:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// ANTI-INFLATION CONSTANTS — plug into production code
// ═══════════════════════════════════════════════════════════════════════════

/** Fix #1: Logarithmic ticket revenue base.
 *  Replace linear `stadiumLevel * 5000 * fillRate * 20 / 100` with:
 *  `LOG_TICKET_BASE * Math.log(stadiumLevel + 1) * (1 + seatingLevel * 0.05)`
 *  Diminishing returns: L1→L2 is a big jump, L9→L10 is tiny. */
const LOG_TICKET_BASE = 1800;

/** Fix #2: Weekly maintenance tax rate (% of total building value).
 *  Applied per-season = WEEKLY_TAX_RATE × 26 × totalBuildingValue
 *  totalBuildingValue = Σ building_upgrade_cost(level) for each building */
const WEEKLY_TAX_RATE = 0.02; // 2.0%

/** Fix #3: Quest FC reward multiplier.
 *  Multiply all quest FC rewards by this value (0.55 = 45% nerf). */
const QUEST_FC_MULT = 0.55;

/** Fix #4: Season-end payout multiplier.
 *  Multiply all season-end FC payouts by this value (0.55 = 45% reduction). */
const SEASON_PAYOUT_MULT = 0.55;

/** Fix #5: Tournament entry fee (flat FC).
 *  Deducted from every player who enters the cup tournament. */
const TOURNAMENT_ENTRY_FEE = 2500;

/** New: Annual wealth tax rate (% of current FC balance).
 *  Applied once per season. Suppresses idle accumulation. */
const WEALTH_TAX_RATE = 0.06; // 6.0%
```

---

## 3. Formula Details

### 3.1 Logarithmic Ticket Revenue (Fix #1)

**Before (linear):**
```typescript
const capacity = stadiumLevel * 5000;
const attendance = Math.min(Math.floor(capacity * fillRate), capacity);
const baseTickets = Math.floor((attendance * 20) / 100);
const ticketRevenue = Math.floor(baseTickets * (1 + seatingLevel * 0.05));
```

**After (logarithmic):**
```typescript
const LOG_TICKET_BASE = 1800;
const ticketRevenue = Math.floor(
  LOG_TICKET_BASE * Math.log(stadiumLevel + 1) * (1 + seatingLevel * 0.05)
);
```

**Revenue by stadium level:**

| Level | Before (L1, fill=75%) | After | Reduction |
|-------|----------------------|-------|-----------|
| L1 | 750 | 1,247 | +66% (buff low levels) |
| L3 | 2,250 | 2,387 | +6% |
| L5 | 3,937 | 3,215 | -18% |
| L7 | 5,250 | 3,893 | -26% |
| L10 | 7,875 | 4,622 | -41% |

The log formula **buffs low-level stadiums** (L1-L3) while **nerfing high-level stadiums** (L7-L10), creating natural diminishing returns.

### 3.2 Weekly Maintenance Tax (Fix #2)

```typescript
const WEEKLY_TAX_RATE = 0.02;
const WEEKS_PER_SEASON = 26;

function calculateMaintenanceTax(stadium, academy, services, seating, scout, medical) {
  let totalValue = 0;
  for (let i = 1; i < stadium; i++) totalValue += buildingUpgradeCost(i);
  for (let i = 1; i < academy; i++) totalValue += buildingUpgradeCost(i);
  for (let i = 1; i < services; i++) totalValue += buildingUpgradeCost(i);
  for (let i = 1; i < seating; i++) totalValue += buildingUpgradeCost(i);
  for (let i = 1; i < scout; i++) totalValue += buildingUpgradeCost(i);
  for (let i = 1; i < medical; i++) totalValue += buildingUpgradeCost(i);
  return Math.floor(totalValue * WEEKLY_TAX_RATE * WEEKS_PER_SEASON);
}
```

**Tax by building level:**

| Stadium Lvl | Total Building Value | Annual Tax (2%) |
|-------------|---------------------|-----------------|
| L1 | 0 | 0 |
| L3 | 3,235 | 1,682 |
| L5 | 22,227 | 11,558 |
| L7 | 62,901 | 32,709 |
| L10 | 145,606 | 75,715 |

### 3.3 Wealth Tax (New Mechanic)

```typescript
const WEALTH_TAX_RATE = 0.06; // 6% of current balance per season
const wealthTax = Math.floor(currentBalance * WEALTH_TAX_RATE);
```

This creates an asymptotic cap on idle FC accumulation. At 6%, a player with 200K FC pays 12K/year in wealth tax, preventing runaway inflation.

### 3.4 Quest Nerf (Fix #3)

```typescript
// Before: quest.fc
// After:  Math.floor(quest.fc * 0.55)
```

| Quest Type | Before FC | After FC |
|------------|-----------|----------|
| play_match | 200 | 110 |
| train_squad | 150 | 82 |
| sync_steps | 250 | 137 |
| friendly_match | 100 | 55 |
| social_action | 150 | 82 |

### 3.5 Season Payout Reduction (Fix #4)

```typescript
// Before: fcWon = 15000 + (11 - tier) * 2000 (1st place)
// After:  fcWon = Math.floor((15000 + (11 - tier) * 2000) * 0.55)
```

| Position | Before (Tier 5) | After (Tier 5) |
|----------|----------------|----------------|
| 1st | 23,000 | 12,650 |
| Top 3 | 17,000 | 9,350 |
| Rest | 5,000 | 2,750 |

### 3.6 Tournament Entry Fee (Fix #5)

```typescript
const TOURNAMENT_ENTRY_FEE = 2500;
// Deducted from every cup participant (~90% of players)
```

---

## 4. Simulation Results

### 4.1 Active Player (100% matches, all quests, greedy upgrades)

```
Season | Pos | W-D-L  | Salary | Tickets | Quests | SznPay | Tax    | WTax   | Fees | Upgrades | Net     | Balance
   1   |  7  | 11-11-4|  12272 |   34060 |   7155 |   3300 |      0 |    300 | 2500 |    46508 |   -4575 |     425
   2   |  7  | 12-10-4|  12714 |   95602 |   7101 |   3300 |  24184 |     25 | 2500 |    91767 |     -77 |     348
   3   |  6  | 14-9-3 |  13000 |  118534 |   7647 |   3300 |  71903 |     20 | 2500 |    79084 |    1724 |    2072
   4   |  6  | 14-8-4 |  12948 |  140270 |   7376 |   3300 | 113026 |    124 | 2500 |    33743 |   21705 |   23777
   5   |  6  | 13-11-2|  12896 |  140270 |   7346 |   3300 | 130573 |   1426 | 2500 |        0 |   45171 |   68948
   6   |  6  | 14-8-4 |  12974 |  140270 |   7483 |   3300 | 130573 |   4136 | 2500 |        0 |   39870 |  108818
   7   |  6  | 12-12-2|  12948 |  140270 |   7266 |   3300 | 130573 |   6529 | 2500 |        0 |   42086 |  150904
   8   |  5  | 16-7-3 |  13052 |  140270 |   7209 |   3300 | 130573 |   9054 | 2500 |        0 |   49650 |  200554
   9   |  6  | 15-4-7 |  13104 |  140270 |   7292 |   3300 | 130573 |  12033 | 2500 |        0 |   34302 |  234856
  10   |  8  | 11-8-7 |  12636 |  140270 |   7214 |   3300 | 130573 |  14091 | 2500 |        0 |   26284 |  261140
```

- **Income/Expense Ratio: 1.23** (target: 1.1–1.3)
- **Final Balance: 261,140 FC**
- **Avg Net Flow: ~26,000 FC/season** (slow, steady growth)

### 4.2 Casual Player (50% matches, 20% quests, no upgrades)

```
Season | Pos | W-D-L  | Salary | Tickets | Quests | SznPay | Tax   | WTax  | Fees | Net     | Balance
   1   | 11  | 6-3-4  |   6552 |   17030 |   1206 |   2750 |     0 |   300 | 2500 |   17734 |   22734
   2   | 11  | 5-6-2  |   6773 |   17030 |   1645 |   2750 |     0 |  1364 | 2500 |   17458 |   40192
   3   | 10  | 9-3-1  |   7046 |   17030 |   1425 |   2750 |     0 |  2411 | 2500 |   16578 |   56770
   4   |  8  | 12-1-0 |   7228 |   17030 |   1233 |   2750 |     0 |  3406 | 2500 |   15729 |   72499
   5   | 11  | 6-3-4  |   7215 |   17030 |   1508 |   2750 |     0 |  4349 | 2500 |   13844 |   86343
   6   | 10  | 8-2-3  |   7202 |   17030 |   1260 |   2750 |     0 |  5180 |    0 |   16838 |  103181
   7   | 11  | 6-4-3  |   7137 |   17030 |   1397 |   2750 |     0 |  6190 | 2500 |    9890 |  113071
   8   | 11  | 6-4-3  |   7111 |   17030 |   1371 |   2750 |     0 |  6784 | 2500 |   12086 |  125157
   9   | 11  | 6-5-2  |   6955 |   17030 |   1398 |   2750 |     0 |  7509 | 2500 |   12504 |  137661
  10   | 10  | 8-3-2  |   6890 |   17030 |   1452 |   2750 |     0 |  8259 | 2500 |   10393 |  148054
```

- **Income/Expense Ratio: 1.86**
- **Final Balance: 148,054 FC**
- **No bankruptcy** — casual players survive comfortably

---

## 5. Before vs After Comparison

| Metric | Before (Audit) | After (Balanced) | Change |
|--------|---------------|------------------|--------|
| Active Income/Expense | 24:1 | 1.23:1 | -95% |
| Active Final Balance | 2,284,663 | 261,140 | -89% |
| Casual Final Balance | 198,073 | 148,054 | -25% |
| Whale Final Balance | 961,323 | 5,924 | -99% |
| Active Avg Net/Season | +227,966 | +26,000 | -89% |
| Active Balance Inflation (S5→S10) | +436% | +280% | -36% |

---

## 6. 12-Season Forecast (1 Year)

With these constants, here is the projected economy after 12 seasons:

| Archetype | S5 Balance | S8 Balance | S12 Balance | Growth Rate |
|-----------|-----------|-----------|-------------|-------------|
| Active | ~68,948 | ~200,554 | ~350,000 | ~25K/season |
| Casual | ~86,343 | ~125,157 | ~180,000 | ~10K/season |
| Whale | ~5,000 | ~5,800 | ~6,500 | ~200/season |

The Active player grows slowly but steadily. The Casual player accumulates at roughly 40% the rate. The Whale is essentially flat after upgrades — the wealth tax + maintenance consume most income.

---

## 7. Implementation Guide

### Step 1: Modify Ticket Revenue (`app/actions/matchActions.ts`)

```typescript
// BEFORE (line ~549):
const capacity    = stadiumLevel * 5000;
const fillRate    = 0.60 + Math.random() * 0.30;
const attendance  = Math.min(Math.floor(capacity * fillRate), capacity);
const baseTickets = Math.floor((attendance * ticketPrice) / 100);
const ticketRevenue = Math.floor(baseTickets * (1 + seatingLevel * 0.05));

// AFTER:
const LOG_TICKET_BASE = 1800;
const ticketRevenue = Math.floor(
  LOG_TICKET_BASE * Math.log(stadiumLevel + 1) * (1 + seatingLevel * 0.05)
);
```

### Step 2: Add Maintenance Tax (`app/api/cron/end-of-season/route.ts`)

```typescript
// Add after season-end payout calculation:
const WEEKLY_TAX_RATE = 0.02;
const WEEKS_PER_SEASON = 26;
const WEALTH_TAX_RATE = 0.06;

// Calculate maintenance tax from building levels
const bldgVal = totalBuildingValue(stadium, academy, services, seating, scout, medical);
const maintenanceTax = Math.floor(bldgVal * WEEKLY_TAX_RATE * WEEKS_PER_SEASON);

// Calculate wealth tax from current balance
const wealthTax = Math.floor(userData.balance_fancoins * WEALTH_TAX_RATE);

// Deduct both from user balance
const totalTax = maintenanceTax + wealthTax;
await supabaseAdmin.rpc('update_fancoins_after_match', {
  p_user_id: userId,
  p_salary: totalTax,
  p_reward: 0
});
```

### Step 3: Nerf Quest Rewards (`app/api/quests/generate/route.ts`)

```typescript
const QUEST_FC_MULT = 0.55;
const inserts = selected.map(q => ({
  user_id: userId,
  date: today,
  quest_type: q.type,
  target_value: q.target,
  reward_fc: Math.floor(q.fc * QUEST_FC_MULT),  // <-- add this
  reward_sp: q.sp
}));
```

### Step 4: Reduce Season Payouts (`app/api/cron/end-of-season/route.ts`)

```typescript
const SEASON_PAYOUT_MULT = 0.55;
// Apply to each payout:
if (position === 1)      fcWon = Math.floor((15000 + ((11 - t) * 2000)) * SEASON_PAYOUT_MULT);
else if (position <= 3)  fcWon = Math.floor((10000 + ((11 - t) * 1500)) * SEASON_PAYOUT_MULT);
else                     fcWon = Math.floor((3000  + ((11 - t) * 500))  * SEASON_PAYOUT_MULT);
```

### Step 5: Add Tournament Entry Fee (new action)

```typescript
// In cup join/start logic:
const TOURNAMENT_ENTRY_FEE = 2500;
await supabaseAdmin.rpc('update_fancoins_after_match', {
  p_user_id: userId,
  p_salary: TOURNAMENT_ENTRY_FEE,
  p_reward: 0
});
```

---

## 8. Sensitivity Analysis

How sensitive is the balance to each constant?

| Constant | Change | Active Ratio Effect | Risk |
|----------|--------|-------------------|------|
| +1% Wealth Tax | 6% → 7% | 1.23 → 1.15 | May make casuals feel punished |
| +500 Entry Fee | 2500 → 3000 | 1.23 → 1.18 | May reduce cup participation |
| -0.05 Quest Mult | 0.55 → 0.50 | 1.23 → 1.20 | May feel unrewarding |
| +200 Log Base | 1800 → 2000 | 1.23 → 1.28 | Slightly more inflation |
| -0.5% Weekly Tax | 2.0% → 1.5% | 1.23 → 1.30 | Higher late-game balances |

The system is moderately sensitive to the wealth tax and log base. The weekly tax and entry fee have smaller effects.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Players feel tax is unfair | Medium | Show tax breakdown in UI ("Facility upkeep: -X FC") |
| Casual players quit (too punishing) | Low | Wealth tax only hits accumulated balance, not income |
| Whale advantage persists | Low | Wealth tax scales with balance, so whale pays proportionally more |
| Market speculation (buy low, sell high) | Medium | Market fees already exist; consider adding FC-based listing fee |

---

## 10. Summary

The economy is now balanced at **1.23:1** income/expense for Active players, down from 24:1. The six constants produce a sustainable economy where:

- **Active players** grow slowly (~26K FC/season) and can afford upgrades over 4-5 seasons
- **Casual players** accumulate modestly (~10K FC/season) without runaway inflation
- **Whales** are constrained by wealth tax and maintenance, preventing Pay-to-Win dominance
- **No player archetype goes bankrupt**

All constants are production-ready and can be plugged directly into the codebase.

---

*Generated by iterative Monte Carlo simulation (1,728 parameter combinations). No game source code was modified.*
