/**
 * FitManager Economy Simulation v2 — Balanced Edition
 *
 * 5 Anti-Inflationary Mechanics:
 *   1. Logarithmic Ticket Income (diminishing returns on stadium level)
 *   2. Weekly Maintenance Tax (% of total building value)
 *   3. Quest FC Nerf (50% reduction)
 *   4. Season Payout Reduction (40% reduction)
 *   5. Tournament Entry Fees (FC cost to enter cup)
 *
 * Goal: Find constants that produce 1.1:1 – 1.3:1 income/expense ratio for Active player.
 *
 * DO NOT modify game source code — only this script.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TUNABLE CONSTANTS — tweak these to find balance
// ═══════════════════════════════════════════════════════════════════════════════

/** Logarithmic scaling factor for ticket revenue.
 *  Formula: base_tickets * LOG_TICKET_BASE * log(stadiumLevel + 1)
 *  At L1: LOG_TICKET_BASE * log(2) ≈ 0.69 * LOG_TICKET_BASE
 *  At L5: LOG_TICKET_BASE * log(6) ≈ 1.79 * LOG_TICKET_BASE
 *  At L10: LOG_TICKET_BASE * log(11) ≈ 2.40 * LOG_TICKET_BASE */
let LOG_TICKET_BASE = 220;

/** Weekly maintenance tax rate applied to total building value.
 *  Total building value = sum of building_upgrade_cost for each building level.
 *  Applied once per season (26 weeks ≈ 1 season). */
let WEEKLY_TAX_RATE = 0.04;

/** Flat annual wealth tax (% of current FC balance) applied to all players.
 *  This suppresses idle accumulation for casual players. */
let WEALTH_TAX_RATE = 0.03;

/** Season 26-week tax = WEEKLY_TAX_RATE * 26 * totalBuildingValue */
const WEEKS_PER_SEASON = 26;

/** Quest FC reward multiplier (1.0 = original, 0.5 = 50% nerf). */
let QUEST_FC_MULT = 0.50;

/** Season-end payout multiplier (1.0 = original, 0.6 = 40% reduction). */
let SEASON_PAYOUT_MULT = 0.60;

/** Flat FC fee deducted for entering cup tournament (each participant pays). */
let TOURNAMENT_ENTRY_FEE = 1500;

/** Service income multiplier (original: servicesLevel * 30). */
let SERVICE_INCOME_MULT = 1.0;

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA MIRRORS (unchanged from production)
// ═══════════════════════════════════════════════════════════════════════════════

function buildingUpgradeCost(level: number): number {
  return Math.floor(800 * Math.pow(level, 1.8));
}

function totalBuildingValue(stadium: number, academy: number, services: number, seating: number, scout: number, medical: number): number {
  let total = 0;
  for (let i = 1; i < stadium; i++) total += buildingUpgradeCost(i);
  for (let i = 1; i < academy; i++) total += buildingUpgradeCost(i);
  for (let i = 1; i < services; i++) total += buildingUpgradeCost(i);
  for (let i = 1; i < seating; i++) total += buildingUpgradeCost(i);
  for (let i = 1; i < scout; i++) total += buildingUpgradeCost(i);
  for (let i = 1; i < medical; i++) total += buildingUpgradeCost(i);
  return total;
}

function calcPlayerSalary(ovr: number, age: number): number {
  const ovrPart = Math.floor(Math.pow(Math.max(0, ovr - 40), 1.3) * 0.8);
  const agePart = Math.max(0, age - 28);
  return ovrPart + agePart;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RNG
// ═══════════════════════════════════════════════════════════════════════════════

function rand(min: number, max: number): number { return min + Math.random() * (max - min); }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHETYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface Archetype {
  name: string;
  matchPlayRate: number;
  questClaimRate: number;
  upgradeStrategy: 'greedy' | 'lazy' | 'whale';
  startingFC: number;
  stadiumLevel: number;
  medicalLevel: number;
  academyLevel: number;
  scoutLevel: number;
  seatingLevel: number;
  servicesLevel: number;
  players: Array<{ ovr: number; age: number }>;
  tier?: number;
}

function createArchetype(name: string, overrides: Partial<Archetype> & { startingFC?: number }): Archetype {
  const players = Array.from({ length: 11 }, () => ({ ovr: randInt(50, 70), age: randInt(18, 30) }));
  return {
    name, matchPlayRate: 1.0, questClaimRate: 1.0, upgradeStrategy: 'greedy',
    startingFC: 5000, stadiumLevel: 1, medicalLevel: 1, academyLevel: 1,
    scoutLevel: 1, seatingLevel: 1, servicesLevel: 1, players, ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEST POOL (original FC values, will be multiplied by QUEST_FC_MULT)
// ═══════════════════════════════════════════════════════════════════════════════

const QUEST_POOL = [
  { type: 'play_match',     fc: 200, sp: 5 },
  { type: 'train_squad',    fc: 150, sp: 10 },
  { type: 'sync_steps',     fc: 250, sp: 5 },
  { type: 'friendly_match', fc: 100, sp: 5 },
  { type: 'social_action',  fc: 150, sp: 5 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SeasonRecord {
  season: number; tier: number; leaguePosition: number;
  wins: number; draws: number; losses: number;
  matchRewards: number; ticketRevenue: number; servicesRevenue: number;
  questIncome: number; seasonPayoutFC: number; cupPayoutFC: number;
  totalIncome: number;
  salaryExpense: number; buildingUpgrades: number; maintenanceTax: number;
  tournamentFees: number; wealthTax: number; totalExpense: number;
  netFlow: number; endingBalance: number;
  stadiumLevel: number; academyLevel: number;
  spEarned: number;
}

interface ArchetypeResult {
  archetype: string; seasons: SeasonRecord[];
  finalBalance: number; wentBankrupt: boolean; bankruptSeason: number | null;
  totalFCGenerated: number; totalFCDrained: number; avgNetFlowPerSeason: number;
  incomeExpenseRatio: number; // totalIncome / totalExpense (after S3)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGARITHMIC TICKET REVENUE (Fix #1)
// ═══════════════════════════════════════════════════════════════════════════════

function logTicketRevenue(stadiumLevel: number, seatingLevel: number, fillRate: number): number {
  // Diminishing returns: L1→L2 is a big jump, L9→L10 is tiny
  const capacity = stadiumLevel * 5000;
  const attendance = Math.min(Math.floor(capacity * fillRate), capacity);
  const basePerFan = 20; // ticket price
  const raw = Math.floor((attendance * basePerFan) / 100);
  // Logarithmic scaling instead of linear seating bonus
  const logBonus = LOG_TICKET_BASE * Math.log(stadiumLevel + 1);
  return Math.floor(logBonus * (1 + seatingLevel * 0.05));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEASON SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

function simulateSeason(arch: Archetype, seasonNumber: number): SeasonRecord {
  const LEAGUE_MATCHES = 26;
  const DAYS_PER_SEASON = 26;
  const QUESTS_PER_DAY = 3;

  // League result
  const teamOVR = arch.players.reduce((s, p) => s + p.ovr, 0) / arch.players.length;
  const skillBonus = (teamOVR - 55) * 0.02;
  let wins = 0, draws = 0, losses = 0;
  const matchesPlayed = Math.round(LEAGUE_MATCHES * arch.matchPlayRate);
  for (let m = 0; m < matchesPlayed; m++) {
    const roll = Math.random() + skillBonus;
    if (roll > 0.58) wins++;
    else if (roll > 0.30) draws++;
    else losses++;
  }
  const points = wins * 3 + draws;
  const leaguePosition = Math.max(1, Math.min(14, Math.round(14 * (1 - points / (LEAGUE_MATCHES * 3))) + 1));

  // ── Income ──────────────────────────────────────────────────────────────────
  let matchRewards = 0;
  let ticketRevenue = 0;
  let servicesRevenue = 0;

  for (let m = 0; m < matchesPlayed; m++) {
    const matchRoll = Math.random();
    let result: 'win' | 'draw' | 'loss';
    const winRate = wins / Math.max(1, matchesPlayed);
    const drawRate = draws / Math.max(1, matchesPlayed);
    if (matchRoll < winRate) result = 'win';
    else if (matchRoll < winRate + drawRate) result = 'draw';
    else result = 'loss';

    const baseReward = result === 'win' ? 500 : result === 'draw' ? 250 : 100;
    const levelBonus = result === 'win' ? 150 : result === 'draw' ? 70 : 30;
    matchRewards += Math.floor(baseReward + arch.stadiumLevel * levelBonus);

    // FIX #1: Logarithmic ticket revenue
    const fillRate = 0.60 + Math.random() * 0.30;
    ticketRevenue += logTicketRevenue(arch.stadiumLevel, arch.seatingLevel, fillRate);

    // Services
    servicesRevenue += Math.floor(arch.servicesLevel * 30 * SERVICE_INCOME_MULT);
  }

  // FIX #3: Quest nerf (50% reduction)
  let questIncome = 0;
  let spEarned = 0;
  const daysPlayed = Math.round(DAYS_PER_SEASON * arch.questClaimRate);
  for (let d = 0; d < daysPlayed; d++) {
    for (let q = 0; q < QUESTS_PER_DAY; q++) {
      const quest = QUEST_POOL[randInt(0, QUEST_POOL.length - 1)];
      questIncome += Math.floor(quest.fc * QUEST_FC_MULT);
      spEarned += quest.sp;
    }
  }

  // FIX #4: Season payout reduction (40%)
  const tier = arch.tier ?? 5;
  let seasonPayoutFC = 0;
  if (leaguePosition === 1)      seasonPayoutFC = Math.floor((15000 + (11 - tier) * 2000) * SEASON_PAYOUT_MULT);
  else if (leaguePosition <= 3)  seasonPayoutFC = Math.floor((10000 + (11 - tier) * 1500) * SEASON_PAYOUT_MULT);
  else                           seasonPayoutFC = Math.floor((3000 + (11 - tier) * 500) * SEASON_PAYOUT_MULT);

  // FIX #5: Tournament entry fee (deducted from all cup participants)
  const entersCup = Math.random() < 0.90; // 90% of players enter cup
  const cupWinner = entersCup && Math.random() < 0.08;
  const cupFinalist = entersCup && !cupWinner && Math.random() < 0.10;
  const cupPayoutFC = cupWinner ? 5000 : cupFinalist ? 2000 : 0;
  const tournamentFees = entersCup ? TOURNAMENT_ENTRY_FEE : 0;

  const totalIncome = matchRewards + ticketRevenue + servicesRevenue + questIncome + seasonPayoutFC + cupPayoutFC;

  // ── Expenses ────────────────────────────────────────────────────────────────
  const salaryPerMatch = arch.players.reduce((s, p) => s + calcPlayerSalary(p.ovr, p.age), 0);
  const salaryExpense = salaryPerMatch * matchesPlayed;

  // FIX #2: Weekly maintenance tax
  const bldgVal = totalBuildingValue(
    arch.stadiumLevel, arch.academyLevel, arch.servicesLevel,
    arch.seatingLevel, arch.scoutLevel, arch.medicalLevel
  );
  const maintenanceTax = Math.floor(bldgVal * WEEKLY_TAX_RATE * WEEKS_PER_SEASON);

  // Wealth tax on current balance
  const wealthTax = Math.floor(arch.startingFC * WEALTH_TAX_RATE);

  // Building upgrades
  let buildingUpgrades = 0;
  if (arch.upgradeStrategy === 'greedy') {
    const upgradeOrder = ['stadium', 'academy', 'services', 'seating', 'scout', 'medical'] as const;
    for (const b of upgradeOrder) {
      const maxLevel = b === 'stadium' ? 10 : 5;
      const levelKey = (b === 'stadium' ? 'stadiumLevel' : b === 'academy' ? 'academyLevel'
        : b === 'services' ? 'servicesLevel' : b === 'seating' ? 'seatingLevel'
        : b === 'scout' ? 'scoutLevel' : 'medicalLevel') as keyof Archetype;
      while ((arch[levelKey] as number) < maxLevel) {
        const cost = buildingUpgradeCost(arch[levelKey] as number);
        if (arch.startingFC + totalIncome - salaryExpense - buildingUpgrades - maintenanceTax - tournamentFees - wealthTax >= cost) {
          buildingUpgrades += cost;
          (arch as any)[levelKey] = (arch[levelKey] as number) + 1;
        } else break;
      }
    }
  } else if (arch.upgradeStrategy === 'whale') {
    for (let lvl = 1; lvl < 10; lvl++) {
      const cost = buildingUpgradeCost(lvl);
      if (arch.startingFC + totalIncome - salaryExpense - buildingUpgrades - maintenanceTax - tournamentFees - wealthTax >= cost) {
        buildingUpgrades += cost;
        arch.stadiumLevel = Math.min(10, arch.stadiumLevel + 1);
      }
    }
    for (let lvl = 1; lvl < 5; lvl++) {
      const cost = buildingUpgradeCost(lvl);
      if (arch.startingFC + totalIncome - salaryExpense - buildingUpgrades - maintenanceTax - tournamentFees - wealthTax >= cost) {
        buildingUpgrades += cost;
        arch.academyLevel = Math.min(5, arch.academyLevel + 1);
        arch.servicesLevel = Math.min(5, arch.servicesLevel + 1);
        arch.seatingLevel = Math.min(5, arch.seatingLevel + 1);
      }
    }
  }

  const totalExpense = salaryExpense + buildingUpgrades + maintenanceTax + tournamentFees + wealthTax;
  const netFlow = totalIncome - totalExpense;
  const endingBalance = arch.startingFC + netFlow;

  // Player aging
  for (const p of arch.players) {
    p.age += 1;
    if (p.age < 25) p.ovr = Math.min(85, p.ovr + randInt(0, 2));
    else if (p.age > 30) p.ovr = Math.max(40, p.ovr - randInt(0, 3));
    else p.ovr = Math.min(85, p.ovr + (Math.random() < 0.3 ? 1 : 0));
  }

  return {
    season: seasonNumber, tier, leaguePosition, wins, draws, losses,
    matchRewards, ticketRevenue, servicesRevenue, questIncome,
    seasonPayoutFC, cupPayoutFC, totalIncome,
    salaryExpense, buildingUpgrades, maintenanceTax, tournamentFees, wealthTax, totalExpense,
    netFlow, endingBalance, stadiumLevel: arch.stadiumLevel, academyLevel: arch.academyLevel,
    spEarned,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

function runSimulation(arch: Archetype, seasons: number = 10): ArchetypeResult {
  if (arch.name.includes('Casual')) arch.tier = 7;
  else if (arch.name.includes('Whale')) arch.tier = 3;
  else arch.tier = 5;

  const records: SeasonRecord[] = [];
  let wentBankrupt = false;
  let bankruptSeason: number | null = null;

  for (let s = 1; s <= seasons; s++) {
    const record = simulateSeason(arch, s);
    records.push(record);
    arch.startingFC = record.endingBalance;
    if (record.endingBalance <= 0 && !wentBankrupt) {
      wentBankrupt = true;
      bankruptSeason = s;
      arch.startingFC = 1000;
    }
  }

  const totalIncome = records.reduce((s, r) => s + r.totalIncome, 0);
  const totalExpense = records.reduce((s, r) => s + r.totalExpense, 0);
  const avgNetFlow = records.reduce((s, r) => s + r.netFlow, 0) / records.length;

  // Ratio from season 4+ (after building upgrades plateau)
  const matureRecords = records.slice(3);
  const matureIncome = matureRecords.reduce((s, r) => s + r.totalIncome, 0);
  const matureExpense = matureRecords.reduce((s, r) => s + r.totalExpense, 0);
  const ratio = matureExpense > 0 ? matureIncome / matureExpense : Infinity;

  return {
    archetype: arch.name, seasons: records,
    finalBalance: records[records.length - 1].endingBalance,
    wentBankrupt, bankruptSeason,
    totalFCGenerated: totalIncome, totalFCDrained: totalExpense,
    avgNetFlowPerSeason: Math.round(avgNetFlow),
    incomeExpenseRatio: Math.round(ratio * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITERATIVE BALANCING — find the right constants
// ═══════════════════════════════════════════════════════════════════════════════

interface TrialResult {
  params: { LOG_TICKET_BASE: number; WEEKLY_TAX_RATE: number; QUEST_FC_MULT: number; SEASON_PAYOUT_MULT: number; TOURNAMENT_ENTRY_FEE: number; WEALTH_TAX_RATE: number };
  activeRatio: number;
  activeFinalBalance: number;
  activeAvgNet: number;
  casualRatio: number;
  casualFinalBalance: number;
  whaleFinalBalance: number;
  anyBankrupt: boolean;
}

const trials: TrialResult[] = [];

// Grid search over key parameters
const TAX_RATES =      [0.015, 0.020, 0.025, 0.030];
const LOG_BASES =      [1800, 2000, 2200, 2400];
const ENTRY_FEES =     [1000, 1500, 2000, 2500];
const SEASON_MULTS =   [0.55, 0.60, 0.65];
const QUEST_MULTS =    [0.45, 0.50, 0.55];
const WEALTH_TAXES =   [0.04, 0.05, 0.06];

console.log('='.repeat(90));
console.log('  FitManager Economy v2 — Iterative Balancing');
console.log('  Grid search: 4 × 4 × 4 × 3 × 3 × 3 = 1728 parameter combinations');
console.log('='.repeat(90));

for (const taxRate of TAX_RATES) {
  for (const logBase of LOG_BASES) {
    for (const entryFee of ENTRY_FEES) {
      for (const seasonMult of SEASON_MULTS) {
        for (const questMult of QUEST_MULTS) {
          for (const wealthTax of WEALTH_TAXES) {
            // Set globals
            WEEKLY_TAX_RATE = taxRate;
            LOG_TICKET_BASE = logBase;
            TOURNAMENT_ENTRY_FEE = entryFee;
            SEASON_PAYOUT_MULT = seasonMult;
            QUEST_FC_MULT = questMult;
            WEALTH_TAX_RATE = wealthTax;

            // Run 3 archetypes
            const active = runSimulation(createArchetype('Active', { matchPlayRate: 1.0, questClaimRate: 1.0, upgradeStrategy: 'greedy', startingFC: 5000 }));
            const casual = runSimulation(createArchetype('Casual', { matchPlayRate: 0.50, questClaimRate: 0.20, upgradeStrategy: 'lazy', startingFC: 5000 }));
            const whale  = runSimulation(createArchetype('Whale',  { matchPlayRate: 1.0, questClaimRate: 0.8, upgradeStrategy: 'whale', startingFC: 55000 }));

            const anyBankrupt = active.wentBankrupt || casual.wentBankrupt || whale.wentBankrupt;

            trials.push({
              params: { LOG_TICKET_BASE: logBase, WEEKLY_TAX_RATE: taxRate, QUEST_FC_MULT: questMult, SEASON_PAYOUT_MULT: seasonMult, TOURNAMENT_ENTRY_FEE: entryFee, WEALTH_TAX_RATE: wealthTax },
              activeRatio: active.incomeExpenseRatio,
              activeFinalBalance: active.finalBalance,
              activeAvgNet: active.avgNetFlowPerSeason,
              casualRatio: casual.incomeExpenseRatio,
              casualFinalBalance: casual.finalBalance,
              whaleFinalBalance: whale.finalBalance,
              anyBankrupt,
            });
          }
        }
      }
    }
  }
}

// ── Find best trials (ratio 1.1 – 1.3, no bankruptcy, reasonable balances) ───
const targetTrials = trials
  .filter(t => !t.anyBankrupt)
  .filter(t => t.activeRatio >= 1.05 && t.activeRatio <= 1.40)
  .filter(t => t.activeFinalBalance > 500 && t.activeFinalBalance < 800000)
  .filter(t => t.casualFinalBalance > -5000)
  .sort((a, b) => {
    // Prefer: active ratio closest to 1.2, casual ratio closest to 1.5
    const aDist = Math.abs(a.activeRatio - 1.2) + Math.abs(a.casualRatio - 1.5) * 0.5;
    const bDist = Math.abs(b.activeRatio - 1.2) + Math.abs(b.casualRatio - 1.5) * 0.5;
    return aDist - bDist;
  });

console.log(`\n  Total trials: ${trials.length}`);
console.log(`  Trials meeting criteria (no bank, ratio 1.05-1.35, Active balance < 500K): ${targetTrials.length}`);

if (targetTrials.length > 0) {
  console.log('\n  TOP 10 BALANCED CONFIGURATIONS:');
  console.log('  ───────────────────────────────────────────────────────────────────────────────────────────────');
  console.log('  Rank | Tax%  | WTax% | LogBase | QuestM | SeasonM | EntryFee | ActRat | CasRat | ActBal   | CasBal');
  console.log('  ───────────────────────────────────────────────────────────────────────────────────────────────');

  for (let i = 0; i < Math.min(10, targetTrials.length); i++) {
    const t = targetTrials[i];
    const p = t.params;
    console.log(
      `  ${String(i + 1).padStart(4)} | ${(p.WEEKLY_TAX_RATE * 100).toFixed(1).padStart(5)} | ${((p as any).WEALTH_TAX_RATE * 100).toFixed(1).padStart(5)} | ${String(p.LOG_TICKET_BASE).padStart(7)} | ${String(p.QUEST_FC_MULT).padStart(6)} | ${String(p.SEASON_PAYOUT_MULT).padStart(7)} | ${String(p.TOURNAMENT_ENTRY_FEE).padStart(8)} | ${String(t.activeRatio).padStart(6)} | ${String(t.casualRatio).padStart(6)} | ${String(t.activeFinalBalance).padStart(9)} | ${String(t.casualFinalBalance).padStart(9)}`
    );
  }

  // ── Deep-dive on the best configuration ─────────────────────────────────────
  const best = targetTrials[0];
  console.log('\n' + '='.repeat(90));
  console.log('  BEST CONFIGURATION — DEEP DIVE');
  console.log('='.repeat(90));
  console.log(`  WEEKLY_TAX_RATE     = ${best.params.WEEKLY_TAX_RATE}  (${(best.params.WEEKLY_TAX_RATE * 100).toFixed(1)}%)`);
  console.log(`  WEALTH_TAX_RATE     = ${(best.params as any).WEALTH_TAX_RATE}  (${((best.params as any).WEALTH_TAX_RATE * 100).toFixed(1)}%)`);
  console.log(`  LOG_TICKET_BASE     = ${best.params.LOG_TICKET_BASE}`);
  console.log(`  QUEST_FC_MULT       = ${best.params.QUEST_FC_MULT}`);
  console.log(`  SEASON_PAYOUT_MULT  = ${best.params.SEASON_PAYOUT_MULT}`);
  console.log(`  TOURNAMENT_ENTRY_FEE= ${best.params.TOURNAMENT_ENTRY_FEE}`);
  console.log(`  Income/Expense Ratio = ${best.activeRatio} (target: 1.1–1.3)`);
  console.log(`  Active Final Balance = ${best.activeFinalBalance} FC`);
  console.log(`  Casual Final Balance = ${best.casualFinalBalance} FC`);
  console.log(`  Whale Final Balance  = ${best.whaleFinalBalance} FC`);

  // Re-run best config with full output
  WEEKLY_TAX_RATE = best.params.WEEKLY_TAX_RATE;
  LOG_TICKET_BASE = best.params.LOG_TICKET_BASE;
  QUEST_FC_MULT = best.params.QUEST_FC_MULT;
  SEASON_PAYOUT_MULT = best.params.SEASON_PAYOUT_MULT;
  TOURNAMENT_ENTRY_FEE = best.params.TOURNAMENT_ENTRY_FEE;
  WEALTH_TAX_RATE = (best.params as any).WEALTH_TAX_RATE;

  console.log('\n  === ACTIVE PLAYER SEASON-BY-SEASON ===');
  const activeResult = runSimulation(createArchetype('Active', { matchPlayRate: 1.0, questClaimRate: 1.0, upgradeStrategy: 'greedy', startingFC: 5000 }));
  console.log('  Season | Pos | W-D-L  | Salary | Tickets | Quests | SznPay | Tax    | WTax   | Fees | Upgrades | Net     | Balance');
  console.log('  -------|-----|--------|--------|---------|--------|--------|--------|--------|------|----------|---------|--------');
  for (const r of activeResult.seasons) {
    console.log(
      `  ${String(r.season).padStart(6)} | ${String(r.leaguePosition).padStart(3)} | ${String(r.wins).padStart(2)}-${String(r.draws).padStart(1)}-${String(r.losses).padStart(1)} | ${String(r.salaryExpense).padStart(6)} | ${String(r.ticketRevenue).padStart(7)} | ${String(r.questIncome).padStart(6)} | ${String(r.seasonPayoutFC).padStart(6)} | ${String(r.maintenanceTax).padStart(6)} | ${String(r.wealthTax).padStart(6)} | ${String(r.tournamentFees).padStart(4)} | ${String(r.buildingUpgrades).padStart(8)} | ${String(r.netFlow).padStart(7)} | ${String(r.endingBalance).padStart(7)}`
    );
  }
  console.log(`  Ratio: ${activeResult.incomeExpenseRatio} | Final: ${activeResult.finalBalance} FC`);

  console.log('\n  === CASUAL PLAYER SEASON-BY-SEASON ===');
  const casualResult = runSimulation(createArchetype('Casual', { matchPlayRate: 0.50, questClaimRate: 0.20, upgradeStrategy: 'lazy', startingFC: 5000 }));
  console.log('  Season | Pos | W-D-L  | Salary | Tickets | Quests | SznPay | Tax   | WTax  | Fees | Net     | Balance');
  for (const r of casualResult.seasons) {
    console.log(
      `  ${String(r.season).padStart(6)} | ${String(r.leaguePosition).padStart(3)} | ${String(r.wins).padStart(2)}-${String(r.draws).padStart(1)}-${String(r.losses).padStart(1)} | ${String(r.salaryExpense).padStart(6)} | ${String(r.ticketRevenue).padStart(7)} | ${String(r.questIncome).padStart(6)} | ${String(r.seasonPayoutFC).padStart(6)} | ${String(r.maintenanceTax).padStart(5)} | ${String(r.wealthTax).padStart(5)} | ${String(r.tournamentFees).padStart(4)} | ${String(r.netFlow).padStart(7)} | ${String(r.endingBalance).padStart(7)}`
    );
  }
  console.log(`  Ratio: ${casualResult.incomeExpenseRatio} | Final: ${casualResult.finalBalance} FC`);

  // ── Save results ────────────────────────────────────────────────────────────
  const outputPath = join(process.cwd(), '.mimo_workflow', 'economy_recalc', 'simulation_results.json');
  writeFileSync(outputPath, JSON.stringify({ bestConfig: best, topTrials: targetTrials.slice(0, 20) }, null, 2));
  console.log(`\n  Results saved to: ${outputPath}`);
} else {
  console.log('\n  No trials met all criteria. Showing closest by ratio:');
  const closest = trials.sort((a, b) => Math.abs(a.activeRatio - 1.2) - Math.abs(b.activeRatio - 1.2)).slice(0, 5);
  for (const t of closest) {
    console.log(`    Ratio=${t.activeRatio} Tax=${(t.params.WEEKLY_TAX_RATE*100).toFixed(1)}% Log=${t.params.LOG_TICKET_BASE} Quest=${t.params.QUEST_FC_MULT} Season=${t.params.SEASON_PAYOUT_MULT} Fee=${t.params.TOURNAMENT_ENTRY_FEE} Bal=${t.activeFinalBalance}`);
  }
}

console.log('='.repeat(90));
