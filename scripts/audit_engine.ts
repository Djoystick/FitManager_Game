/**
 * FitManager Match Engine Audit — Stress Test Script
 *
 * Runs 10,000 match simulations across various scenarios.
 * Outputs statistical results to engine_stats.json.
 *
 * DO NOT modify production code — this is a read-only audit tool.
 */

import { simulateMatch, type MatchPlayer, type MatchPlayerStats, type TacticalStyle, type MatchResult } from '../app/utils/matchEngine';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createPlayer(ovr: number, position: string, traits: string[] = []): MatchPlayer {
  const base = ovr;
  const jitter = () => randInt(-8, 8);
  const stats: MatchPlayerStats = {
    pace:      Math.max(1, Math.min(99, base + jitter())),
    shooting:  Math.max(1, Math.min(99, base + jitter())),
    passing:   Math.max(1, Math.min(99, base + jitter())),
    dribbling: Math.max(1, Math.min(99, base + jitter())),
    defending: Math.max(1, Math.min(99, base + jitter())),
    physical:  Math.max(1, Math.min(99, base + jitter())),
  };
  return {
    id: `p_${Math.random().toString(36).slice(2, 8)}`,
    name: `Player_${randInt(1, 999)}`,
    position,
    stats,
    stamina: 80 + randInt(0, 20),
    traits,
    morale: 70 + randInt(-20, 20),
  };
}

function createTeam(ovr: number, traits: string[] = []): MatchPlayer[] {
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
  return positions.map(pos => createPlayer(ovr, pos, traits));
}

const TACTICS: TacticalStyle[] = ['Tiki-Taka', 'Counter Attack', 'High Press', 'Park the Bus', 'Wing Play', 'Balanced'];

// ─── Statistics Tracker ───────────────────────────────────────────────────────

interface Stats {
  totalMatches: number;
  totalGoals: number;
  goalsPerGame: number;
  maxGoalsInMatch: number;
  minGoalsInMatch: number;
  extremeScorelines: Array<{ home: number; away: number; count: number }>;
  redCards: number;
  yellowCards: number;
  secondYellows: number;
  penaltiesInGame: number;
  penaltyShootouts: number;
  maxPenaltyShootoutLength: number;
  ownGoals: number;
  injuries: number;
  offsideCount: number;
  crossbarHits: number;
  tacticWinRates: Record<string, { wins: number; losses: number; draws: number }>;
  ovrDiffImpact: Array<{ diff: number; avgHomeGoals: number; avgAwayGoals: number; homeWinPct: number }>;
  emptyTeamCrashes: number;
  scorelineDistribution: Record<string, number>;
  scenarioResults: Record<string, { avgGoals: number; maxScore: number; homeWinPct: number }>;
}

function createEmptyStats(): Stats {
  return {
    totalMatches: 0,
    totalGoals: 0,
    goalsPerGame: 0,
    maxGoalsInMatch: 0,
    minGoalsInMatch: Infinity,
    extremeScorelines: [],
    redCards: 0,
    yellowCards: 0,
    secondYellows: 0,
    penaltiesInGame: 0,
    penaltyShootouts: 0,
    maxPenaltyShootoutLength: 0,
    ownGoals: 0,
    injuries: 0,
    offsideCount: 0,
    crossbarHits: 0,
    tacticWinRates: {},
    ovrDiffImpact: [],
    emptyTeamCrashes: 0,
    scorelineDistribution: {},
    scenarioResults: {},
  };
}

function updateStats(stats: Stats, result: MatchResult, scenario: string) {
  const totalGoals = result.score.home + result.score.away;
  stats.totalMatches++;
  stats.totalGoals += totalGoals;
  stats.maxGoalsInMatch = Math.max(stats.maxGoalsInMatch, totalGoals);
  stats.minGoalsInMatch = Math.min(stats.minGoalsInMatch, totalGoals);

  // Scoreline
  const key = `${result.score.home}-${result.score.away}`;
  stats.scorelineDistribution[key] = (stats.scorelineDistribution[key] || 0) + 1;

  // Events
  for (const ev of result.events) {
    if (ev.type === 'red_card') stats.redCards++;
    if (ev.type === 'yellow_card') stats.yellowCards++;
    if (ev.type === 'second_yellow') stats.secondYellows++;
    if (ev.type === 'own_goal') stats.ownGoals++;
    if (ev.type === 'injury') stats.injuries++;
    if (ev.type === 'offside') stats.offsideCount++;
    if (ev.type === 'crossbar') stats.crossbarHits++;
  }

  // Penalties
  if (result.penalties) {
    stats.penaltyShootouts++;
    const penTotal = result.penalties.home + result.penalties.away;
    stats.maxPenaltyShootoutLength = Math.max(stats.maxPenaltyShootoutLength, penTotal);
  }

  // Track penalties in regular time
  const penEvents = result.events.filter(e => e.type === 'penalty_save' || e.type === 'penalty_goal' || e.type === 'penalty_miss');
  if (penEvents.length > 0) stats.penaltiesInGame++;

  // Scenario tracking
  if (!stats.scenarioResults[scenario]) {
    stats.scenarioResults[scenario] = { avgGoals: 0, maxScore: 0, homeWinPct: 0 };
  }
  const s = stats.scenarioResults[scenario];
  s.avgGoals = (s.avgGoals * (stats.totalMatches - 1) + totalGoals) / stats.totalMatches;
  s.maxScore = Math.max(s.maxScore, totalGoals);
  if (result.score.home > result.score.away) s.homeWinPct += 1;
}

// ─── Main Simulation ──────────────────────────────────────────────────────────

console.log('='.repeat(80));
console.log('  FitManager Match Engine — Stress Test (10,000 simulations)');
console.log('='.repeat(80));

const SIMS_PER_SCENARIO = 2000;
const stats = createEmptyStats();

// ── Scenario 1: Equal Teams (OVR 50 vs 50) ──────────────────────────────────
console.log('\n  Running Scenario 1: Equal Teams (50 vs 50)...');
for (let i = 0; i < SIMS_PER_SCENARIO; i++) {
  const home = createTeam(50);
  const away = createTeam(50);
  const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');
  updateStats(stats, result, 'equal_50v50');
}

// ── Scenario 2: David vs Goliath (40 vs 90) ──────────────────────────────────
console.log('  Running Scenario 2: David vs Goliath (40 vs 90)...');
for (let i = 0; i < SIMS_PER_SCENARIO; i++) {
  const home = createTeam(40);
  const away = createTeam(90);
  const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');
  updateStats(stats, result, 'david_vs_goliath_40v90');
}

// ── Scenario 3: Tactics Clash ─────────────────────────────────────────────────
console.log('  Running Scenario 3: Tactics Clash...');
const tacticPairs: [TacticalStyle, TacticalStyle][] = [
  ['Tiki-Taka', 'Park the Bus'],
  ['Counter Attack', 'High Press'],
  ['Wing Play', 'Balanced'],
  ['High Press', 'Tiki-Taka'],
  ['Park the Bus', 'Counter Attack'],
];
for (const [home, away] of tacticPairs) {
  for (let i = 0; i < SIMS_PER_SCENARIO / tacticPairs.length; i++) {
    const homeTeam = createTeam(65);
    const awayTeam = createTeam(65);
    const result = simulateMatch(homeTeam, awayTeam, [], [], {}, {}, home, away);
    updateStats(stats, result, `tactic_${home}_vs_${away}`);
  }
}

// ── Scenario 4: Extreme Trait Combinations ────────────────────────────────────
console.log('  Running Scenario 4: Extreme Traits...');
const traitCombos = [
  ['SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER',
   'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER', 'SEASON_AWARD_WINNER'],
  ['CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER',
   'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER', 'CLINICAL_FINISHER'],
  ['Speedster', 'Engine', 'Tireless', 'Comeback Kid', 'Clutch',
   'Anchor', 'Enforcer', 'Aerial Threat', 'Dive King', 'Playmaker', 'Poacher'],
];
for (const traits of traitCombos) {
  for (let i = 0; i < SIMS_PER_SCENARIO / traitCombos.length; i++) {
    const home = createTeam(70, traits);
    const away = createTeam(70, []);
    const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');
    updateStats(stats, result, `traits_${traits[0]}`);
  }
}

// ── Scenario 5: OVR Difference Impact ────────────────────────────────────────
console.log('  Running Scenario 5: OVR Difference Impact...');
const ovrDiffs = [0, 10, 20, 30, 40, 50];
for (const diff of ovrDiffs) {
  for (let i = 0; i < 500; i++) {
    const homeOvr = 50 + Math.floor(diff / 2);
    const awayOvr = 50 - Math.floor(diff / 2);
    const home = createTeam(homeOvr);
    const away = createTeam(awayOvr);
    const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');

    if (!stats.ovrDiffImpact.find(d => d.diff === diff)) {
      stats.ovrDiffImpact.push({ diff, avgHomeGoals: 0, avgAwayGoals: 0, homeWinPct: 0 });
    }
    const d = stats.ovrDiffImpact.find(x => x.diff === diff)!;
    const idx = stats.totalMatches;
    d.avgHomeGoals = (d.avgHomeGoals * idx + result.score.home) / (idx + 1);
    d.avgAwayGoals = (d.avgAwayGoals * idx + result.score.away) / (idx + 1);
    if (result.score.home > result.score.away) d.homeWinPct += 1;

    updateStats(stats, result, `ovr_diff_${diff}`);
  }
}

// ── Scenario 6: Empty Team Edge Case ─────────────────────────────────────────
console.log('  Running Scenario 6: Edge Cases...');
try {
  const result = simulateMatch([], [], [], [], {}, {});
  stats.emptyTeamCrashes++;
  console.log('    ⚠️ Empty team did NOT crash — returned:', JSON.stringify(result.score));
} catch (e) {
  console.log('    ✅ Empty team correctly crashed');
}

// ── Scenario 7: Extreme stamina ───────────────────────────────────────────────
for (let i = 0; i < 200; i++) {
  const home = createTeam(60);
  const away = createTeam(60);
  // Drain all stamina
  home.forEach(p => { p.stamina = 0; });
  away.forEach(p => { p.stamina = 0; });
  const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');
  updateStats(stats, result, 'zero_stamina');
}

// ── Scenario 8: All same position ────────────────────────────────────────────
let allSamePositionCrashes = 0;
for (let i = 0; i < 200; i++) {
  try {
    const home = Array.from({ length: 11 }, () => createPlayer(60, 'ST'));
    const away = Array.from({ length: 11 }, () => createPlayer(60, 'GK'));
    const result = simulateMatch(home, away, [], [], {}, {}, 'Balanced', 'Balanced');
    updateStats(stats, result, 'all_st_vs_all_gk');
  } catch {
    allSamePositionCrashes++;
  }
}
console.log(`    All-ST vs All-GK crashes: ${allSamePositionCrashes}/200`);

// ── Compute Final Stats ──────────────────────────────────────────────────────
stats.goalsPerGame = stats.totalGoals / stats.totalMatches;
stats.minGoalsInMatch = stats.minGoalsInMatch === Infinity ? 0 : stats.minGoalsInMatch;

// Normalize homeWinPct in ovrDiffImpact
stats.ovrDiffImpact.forEach(d => { d.homeWinPct = Math.round((d.homeWinPct / 500) * 100); });

// Normalize scenario homeWinPct
Object.keys(stats.scenarioResults).forEach(k => {
  const s = stats.scenarioResults[k];
  // Approximate: count matches per scenario
  const matchCount = k.includes('equal') || k.includes('david') ? SIMS_PER_SCENARIO
    : k.includes('ovr_diff') ? 500
    : k.includes('zero_stamina') || k.includes('all_st') ? 200
    : Math.floor(SIMS_PER_SCENARIO / (k.includes('tactic') ? tacticPairs.length : traitCombos.length));
  s.homeWinPct = Math.round((s.homeWinPct / matchCount) * 100);
});

// Top extreme scorelines
const sortedScorelines = Object.entries(stats.scorelineDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([score, count]) => ({ score, count }));

// ─── Output ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('  RESULTS');
console.log('='.repeat(80));
console.log(`  Total matches simulated: ${stats.totalMatches}`);
console.log(`  Average goals per game: ${stats.goalsPerGame.toFixed(2)}`);
console.log(`  Max goals in a single match: ${stats.maxGoalsInMatch}`);
console.log(`  Min goals in a single match: ${stats.minGoalsInMatch}`);
console.log(`  Red cards: ${stats.redCards}`);
console.log(`  Yellow cards: ${stats.yellowCards}`);
console.log(`  Second yellows: ${stats.secondYellows}`);
console.log(`  Penalty shootouts: ${stats.penaltyShootouts}`);
console.log(`  Max penalty shootout length: ${stats.maxPenaltyShootoutLength}`);
console.log(`  Own goals: ${stats.ownGoals}`);
console.log(`  Injuries: ${stats.injuries}`);
console.log(`  Offsides: ${stats.offsideCount}`);
console.log(`  Crossbar hits: ${stats.crossbarHits}`);
console.log(`  Empty team crashes: ${stats.emptyTeamCrashes}`);

console.log('\n  Top 20 Scorelines:');
sortedScorelines.forEach(s => console.log(`    ${s.score}: ${s.count} times`));

console.log('\n  Scenario Results:');
Object.entries(stats.scenarioResults).forEach(([k, v]) => {
  console.log(`    ${k}: avg=${v.avgGoals.toFixed(2)} goals, max=${v.maxScore}, homeWin=${v.homeWinPct}%`);
});

console.log('\n  OVR Difference Impact:');
stats.ovrDiffImpact.forEach(d => {
  console.log(`    Diff=${d.diff > 0 ? '+' : ''}${d.diff}: homeGoals=${d.avgHomeGoals.toFixed(2)}, awayGoals=${d.avgAwayGoals.toFixed(2)}, homeWin=${d.homeWinPct}%`);
});

// Write JSON
const outputPath = join(process.cwd(), '.mimo_workflow', 'engine_audit', 'engine_stats.json');
writeFileSync(outputPath, JSON.stringify({
  summary: {
    totalMatches: stats.totalMatches,
    goalsPerGame: stats.goalsPerGame,
    maxGoalsInMatch: stats.maxGoalsInMatch,
    redCards: stats.redCards,
    yellowCards: stats.yellowCards,
    penaltyShootouts: stats.penaltyShootouts,
    maxPenaltyShootoutLength: stats.maxPenaltyShootoutLength,
    ownGoals: stats.ownGoals,
    injuries: stats.injuries,
  },
  scenarioResults: stats.scenarioResults,
  ovrDiffImpact: stats.ovrDiffImpact,
  topScorelines: sortedScorelines,
  emptyTeamCrashes: stats.emptyTeamCrashes,
}, null, 2));

console.log(`\n  Results saved to: ${outputPath}`);
console.log('='.repeat(80));
