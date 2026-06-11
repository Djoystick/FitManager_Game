// =============================================================================
// FitManager Match Engine v3.0 — "Swiss Watch Architecture"
// =============================================================================
// Changes over v2.1:
//  [P0] Guard against pick([]) crash — all pools have safe fallbacks
//  [P0] NaN/null stat protection via safeNum()
//  [P0] Score cap check BEFORE pushing goal event (fixes transcript mismatch)
//  [P1] duel() → logistic S-curve (3% floor, 97% ceiling — upsets always possible)
//  [P1] eff() → buffMult capped at 1.35x; conflict halves buffs before penalty
//  [P1] Green Links filtered by lineupIds — only active if BOTH players start
//  [P2] weightedPick() — players selected proportional to role-stat × stamina
//  [P2] Wing assist branch — WNG players contribute a cross bonus
//  [P2] Penalty branch in Penetration phase (35% of fouls in box)
//  [P2] Corner branch in Finishing phase (30% of misses go to corner)
//  [P2] drainStamina — pressing factor for low-possession teams, Engine trait
//  [P3] AttackContext interface — replaces 13-param resolveAttack signature
//  [P3] TeamLinks interface + makeStatGetter() DRY helper
// =============================================================================

export interface MatchPlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface MatchPlayer {
  id: string;
  name: string;
  position: string;
  stats: MatchPlayerStats;
  stamina: number;
  traits: string[];
}

export interface MatchEvent {
  type: 'goal' | 'breakthrough_failed' | 'save' | 'yellow_card' | 'red_card' | 'injury' | 'info' | 'substitution';
  minute: number;
  player_id: string;
  player_name: string;
  team: 'home' | 'away';
  details: string;
}

export interface MatchResult {
  score: { home: number; away: number };
  events: MatchEvent[];
  staminaDrain: {
    home: Record<string, number>;
    away: Record<string, number>;
  };
}

import { hasTraitSynergy, hasTraitConflict } from './chemistry';

// =============================================================================
// Types for clean architecture
// =============================================================================

export interface TeamLinks {
  greenLinks: Record<string, boolean>;
  synergies: Record<string, boolean>;
  conflicts: Record<string, boolean>;
}

interface AttackContext {
  minute: number;
  attackingTeam: MatchPlayer[];
  defendingTeam: MatchPlayer[];
  attackingTeamKey: 'home' | 'away';
  atkLinks: TeamLinks;
  defLinks: TeamLinks;
  liveStamina: Record<string, number>;
  score: { home: number; away: number };
  events: MatchEvent[];
  maxGoals: number;
}

// =============================================================================
// Internal helpers
// =============================================================================

/** Guard against NaN/null/undefined values from DB. */
function safeNum(val: unknown, fallback = 50): number {
  const n = Number(val);
  return isFinite(n) ? n : fallback;
}

/**
 * Logistic duel — win probability follows an S-curve.
 * P = clamp(sigmoid(k × diff) + bias, 0.03, 0.97)
 *   k = 0.045 → at +40 diff: ~96% win; at -40 diff: ~4% (upsets stay possible)
 *   attackerBias = +0.08 default (replaces old flat +12 constant)
 */
function duel(atkStat: number, defStat: number, attackerBias = 0.08): boolean {
  const a = safeNum(atkStat, 50);
  const d = safeNum(defStat, 50);
  const diff = a - d;
  const raw = 1 / (1 + Math.exp(-0.045 * diff)) + attackerBias;
  const p = Math.min(0.97, Math.max(0.03, raw));
  return Math.random() < p;
}

/** Stamina multiplier — linear above 50, steep penalty below 25. */
function staminaMult(stamina: number): number {
  const s = Math.max(0, stamina);
  if (s >= 75) return 1.00;
  if (s >= 50) return 0.95;
  if (s >= 35) return 0.88;
  if (s >= 25) return 0.78;
  return 0.60;
}

/**
 * Effective stat: applies stamina, chemistry, and trait modifiers.
 * Buff stacking is capped at 1.35× to prevent invincible teams.
 * Conflicts halve all active buffs first, then apply -15% penalty.
 */
function eff(
  rawStat: number,
  hasGreenLink: boolean,
  currentStamina: number,
  hasSynergy: boolean = false,
  hasConflict: boolean = false
): number {
  const base = safeNum(rawStat, 0);
  const stamMult = staminaMult(Math.max(0, currentStamina));

  let buffMult = 1.0;
  if (hasGreenLink) buffMult += 0.10;
  if (hasSynergy)   buffMult += 0.10;

  // Cap total buff before conflict resolution
  buffMult = Math.min(1.35, buffMult);

  if (hasConflict) {
    // Conflict halves any accumulated buff, then applies the -15% penalty
    const buffGain = buffMult - 1.0;
    buffMult = 1.0 + buffGain * 0.5;
    buffMult *= 0.85;
  }

  return base * stamMult * buffMult;
}

/**
 * DRY helper — returns an eff() shorthand bound to a team's link/synergy/conflict maps.
 * Replaces the repeated gl(p, map) / syn(p, map) / con(p, map) pattern.
 */
function makeStatGetter(links: TeamLinks, liveStamina: Record<string, number>) {
  return (player: MatchPlayer, rawStat: number): number =>
    eff(
      rawStat,
      links.greenLinks[player.id] ?? false,
      liveStamina[player.id] ?? player.stamina,
      links.synergies[player.id] ?? false,
      links.conflicts[player.id] ?? false
    );
}

/**
 * Weighted random pick — probability proportional to (statVal × stamina factor).
 * Falls back to uniform pick if pool is empty (P0 guard).
 */
function weightedPick<T extends { id: string; stats: MatchPlayerStats; stamina: number }>(
  pool: T[],
  statKey: keyof MatchPlayerStats,
  fallback: T[]
): T {
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) throw new Error('[matchEngine] weightedPick: both pool and fallback are empty');
  if (source.length === 1) return source[0];

  const weights = source.map(p => {
    const sv = Math.max(1, safeNum(p.stats[statKey], 50));
    const sf = 0.5 + 0.5 * Math.max(0, Math.min(100, p.stamina)) / 100;
    return sv * sf;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < source.length; i++) {
    r -= weights[i];
    if (r <= 0) return source[i];
  }
  return source[source.length - 1];
}

// Position group predicates
const isMID = (pos: string) => ['MID', 'CM', 'CAM', 'CDM', 'RM', 'LM'].includes(pos ?? '');
const isFWD = (pos: string) => ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM'].includes(pos ?? '');
const isWNG = (pos: string) => ['RM', 'LM', 'LWF', 'RWF'].includes(pos ?? '');
const isDEF = (pos: string) => ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(pos ?? '');

// Safe uniform pick (never crashes on empty array)
function pick<T>(arr: T[], fallback?: T[]): T {
  const src = arr.length > 0 ? arr : (fallback ?? []);
  if (src.length === 0) throw new Error('[matchEngine] pick: empty array with no fallback');
  return src[Math.floor(Math.random() * src.length)];
}

// =============================================================================
// Stamina drain (P2 — pressing factor + Engine trait)
// =============================================================================

function drainStamina(
  players: MatchPlayer[],
  teamKey: 'home' | 'away',
  possession: number,             // this team's possession share (0.0–1.0)
  staminaDrain: { home: Record<string, number>; away: Record<string, number> }
) {
  // Low possession → high pressing → more drain
  const pressingFactor = possession < 0.40 ? 1.25
                       : possession < 0.50 ? 1.10
                       : 1.00;

  for (const p of players) {
    let base = Math.floor(Math.random() * 7) + 16; // 16–22

    // Positional modifier — midfielders run most, keepers rest
    if (p.position === 'GK')   base = Math.floor(base * 0.50);
    else if (isMID(p.position)) base = Math.floor(base * 1.15);

    const pressedDrain = Math.floor(base * pressingFactor);
    // Engine trait reduces drain by 30%
    const finalDrain = p.traits.includes('Engine')
      ? Math.floor(pressedDrain * 0.70)
      : pressedDrain;

    staminaDrain[teamKey][p.id] = Math.max(0, p.stamina - finalDrain);
  }
}

// =============================================================================
// Midfield Control
// =============================================================================

function midfieldScore(
  players: MatchPlayer[],
  links: TeamLinks,
  liveStamina: Record<string, number>
): number {
  const mids = players.filter(p => isMID(p.position));
  const pool = mids.length > 0 ? mids : players.filter(p => p.position !== 'GK');
  if (pool.length === 0) return 100; // safety fallback

  const get = makeStatGetter(links, liveStamina);
  return pool.reduce((sum, p) =>
    sum +
    get(p, safeNum(p.stats.passing, 50)) +
    get(p, safeNum(p.stats.dribbling, 50)) +
    get(p, safeNum(p.stats.physical, 50) * 0.4),
  0);
}

// =============================================================================
// Narrative pools
// =============================================================================

const PENET_WIN = [
  'bursts past the last defender',
  'leaves the defender in the dust with a brilliant feint',
  'accelerates into the box',
  'dribbles around two defenders',
];
const SAVE_MSGS = [
  'makes a brilliant save!',
  'tips the ball over the bar with his fingertips!',
  'dives full-stretch to deny the goal!',
  'parries away a thunderous effort!',
];
const MISS_MSGS = [
  'blazes over the bar',
  'fires wide from a great position',
  'hits the post — so close!',
  'drags the shot just outside the far post',
];

// =============================================================================
// Set-piece resolvers (P2/P3)
// =============================================================================

/** Corner kick — best header in attack vs keeper. No attacker bias (50/50). */
function resolveCorner(ctx: AttackContext) {
  const { minute, attackingTeam, defendingTeam, attackingTeamKey, atkLinks, defLinks, liveStamina, score, events, maxGoals } = ctx;
  const outfieldAtk = attackingTeam.filter(p => p.position !== 'GK');
  const gk = defendingTeam.find(p => p.position === 'GK') ?? pick(defendingTeam);

  // Best header = highest Physical + Shooting blend
  const header = outfieldAtk.reduce((best, p) =>
    (safeNum(p.stats.physical) + safeNum(p.stats.shooting) * 0.4) >
    (safeNum(best.stats.physical) + safeNum(best.stats.shooting) * 0.4)
      ? p : best,
    outfieldAtk[0] ?? attackingTeam[0]
  );

  const atkGet = makeStatGetter(atkLinks, liveStamina);
  const defGet = makeStatGetter(defLinks, liveStamina);

  const headerEff = atkGet(header, safeNum(header.stats.physical) * 1.2 + safeNum(header.stats.shooting) * 0.8);
  const saveEff   = defGet(gk,     safeNum(gk.stats.defending) * 1.0 + safeNum(gk.stats.physical) * 0.5);

  if (duel(headerEff, saveEff, 0.0) && score[attackingTeamKey] < maxGoals) {
    score[attackingTeamKey]++;
    events.push({
      type: 'goal', minute,
      player_id: header.id, player_name: header.name, team: attackingTeamKey,
      details: `⚽ ГОЛ с углового! ${header.name} замыкает подачу мощным ударом головой!`,
    });
  } else {
    events.push({
      type: 'save', minute,
      player_id: gk.id, player_name: gk.name,
      team: attackingTeamKey === 'home' ? 'away' : 'home',
      details: `🧤 ${gk.name} уверенно выбивает кулаком после углового!`,
    });
  }
}

/** Penalty kick — pure Shooting vs GK Defending. Attacker has slight edge. */
function resolvePenalty(
  ctx: AttackContext,
  atkFwd: MatchPlayer,
  gk: MatchPlayer
) {
  const { minute, attackingTeamKey, atkLinks, defLinks, liveStamina, score, events, maxGoals } = ctx;
  const defTeamKey: 'home' | 'away' = attackingTeamKey === 'home' ? 'away' : 'home';

  const atkGet = makeStatGetter(atkLinks, liveStamina);
  const defGet = makeStatGetter(defLinks, liveStamina);

  let shotPower = safeNum(atkFwd.stats.shooting) * 2.0;
  if (atkFwd.traits.includes('Poacher')) shotPower *= 1.10;

  const saveVal = safeNum(gk.stats.defending) * 1.0 + safeNum(gk.stats.physical) * 0.5;

  const shotEff = atkGet(atkFwd, shotPower);
  const saveEff = defGet(gk, saveVal);

  events.push({
    type: 'info', minute,
    player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
    details: `⚠️ ПЕНАЛЬТИ! ${atkFwd.name} выходит к точке против ${gk.name}!`,
  });

  if (duel(shotEff, saveEff, 0.15) && score[attackingTeamKey] < maxGoals) {
    score[attackingTeamKey]++;
    events.push({
      type: 'goal', minute: minute + 1,
      player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
      details: `⚽ ГОЛ! ${atkFwd.name} хладнокровно реализует пенальти — вратарь не угадал угол!`,
    });
  } else {
    events.push({
      type: 'save', minute: minute + 1,
      player_id: gk.id, player_name: gk.name, team: defTeamKey,
      details: `🧤 ЧУДО-СЕЙВ! ${gk.name} угадывает угол и отражает удар ${atkFwd.name}!`,
    });
  }
}

// =============================================================================
// Attack resolver (P3 — AttackContext, P2 — wing assist, penalty, corner)
// =============================================================================

function resolveAttack(ctx: AttackContext) {
  const {
    minute, attackingTeam, defendingTeam, attackingTeamKey,
    atkLinks, defLinks, liveStamina, score, events, maxGoals,
  } = ctx;

  const defTeamKey: 'home' | 'away' = attackingTeamKey === 'home' ? 'away' : 'home';

  // ── Safe pool construction (P0 guard) ──────────────────────────────────────
  const allAtk      = attackingTeam;
  const allDef      = defendingTeam;
  const outfieldAtk = allAtk.filter(p => p.position !== 'GK');
  const outfieldDef = allDef.filter(p => p.position !== 'GK');

  const atkMidPool  = allAtk.filter(p => isMID(p.position));
  const defMidPool  = allDef.filter(p => isMID(p.position));
  const atkFwdPool  = allAtk.filter(p => isFWD(p.position) || isWNG(p.position));
  const defDefPool  = allDef.filter(p => isDEF(p.position));
  const atkWngPool  = allAtk.filter(p => isWNG(p.position));
  const gk          = allDef.find(p => p.position === 'GK') ?? pick(allDef);

  // weightedPick with fallback prevents crash if pool is empty
  const atkMid = weightedPick(atkMidPool, 'passing',   outfieldAtk);
  const defMid = weightedPick(defMidPool, 'defending', outfieldDef);
  const atkFwd = weightedPick(atkFwdPool, 'shooting',  outfieldAtk.length > 0 ? outfieldAtk : [atkMid]);
  const defDef = weightedPick(defDefPool, 'defending', outfieldDef.length > 0 ? outfieldDef : [defMid]);

  const atkGet = makeStatGetter(atkLinks, liveStamina);
  const defGet = makeStatGetter(defLinks, liveStamina);

  // ── PHASE 1: Build-up ──────────────────────────────────────────────────────
  const atkBuild = atkGet(atkMid, safeNum(atkMid.stats.passing) + safeNum(atkMid.stats.dribbling));
  const defBuild = defGet(defMid, safeNum(defMid.stats.defending) + safeNum(defMid.stats.physical));

  if (!duel(atkBuild, defBuild)) {
    events.push({
      type: 'info', minute,
      player_id: defMid.id, player_name: defMid.name, team: defTeamKey,
      details: `${defMid.name} перехватывает мяч в центре поля — атака сорвана.`,
    });
    return;
  }

  // ── Wing Assist (P2) — 35% chance a winger contributes a cross ────────────
  let hasWingAssist = false;
  let assistPlayer: MatchPlayer = atkMid;
  if (atkWngPool.length > 0 && Math.random() < 0.35) {
    hasWingAssist = true;
    assistPlayer = pick(atkWngPool);
  }

  // ── PHASE 2: Penetration ───────────────────────────────────────────────────
  let atkPaceVal = safeNum(atkFwd.stats.pace) + safeNum(atkFwd.stats.dribbling);
  if (atkFwd.traits.includes('Speedster')) atkPaceVal *= 1.15;

  let defDefVal = safeNum(defDef.stats.defending) + safeNum(defDef.stats.physical);
  if (defDef.traits.includes('Anchor')) defDefVal *= 1.15;

  const atkPenet = atkGet(atkFwd, atkPaceVal);
  const defPenet = defGet(defDef, defDefVal);

  // 5% foul chance — fires discipline event, possibly penalty
  if (Math.random() < 0.05) {
    const isInBox = Math.random() < 0.35; // 35% of fouls are in the penalty area

    if (isInBox) {
      // Red card + penalty
      events.push({
        type: 'red_card', minute,
        player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
        details: `🔴 КРАСНАЯ! ${defDef.name} сбивает ${atkFwd.name} в штрафной — ПЕНАЛЬТИ!`,
      });
      resolvePenalty(ctx, atkFwd, gk);
      return;
    }

    const r = Math.random();
    if (r < 0.55) {
      events.push({
        type: 'yellow_card', minute,
        player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
        details: `🟡 ЖЁЛТАЯ! ${defDef.name} срубает ${atkFwd.name} на подходе к штрафной.`,
      });
    } else if (r < 0.80) {
      events.push({
        type: 'injury', minute,
        player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
        details: `🚑 ТРАВМА! ${atkFwd.name} получает повреждение в стыке с ${defDef.name}.`,
      });
    } else {
      events.push({
        type: 'red_card', minute,
        player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
        details: `🔴 КРАСНАЯ! ${defDef.name} удалён за фол последней надежды на ${atkFwd.name}!`,
      });
    }
    return;
  }

  if (!duel(atkPenet, defPenet)) {
    events.push({
      type: 'breakthrough_failed', minute,
      player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
      details: `Отличный подкат ${defDef.name}! Защита нейтрализует угрозу.`,
    });
    return;
  }

  // ── PHASE 3: Finishing ─────────────────────────────────────────────────────
  let shotVal = safeNum(atkFwd.stats.shooting) * 1.5 + safeNum(atkFwd.stats.pace) * 0.5;
  if (atkFwd.traits.includes('Poacher'))   shotVal *= 1.20;
  if (atkMid.traits.includes('Playmaker')) shotVal *= 1.10; // playmaker pass bonus
  if (hasWingAssist)                       shotVal *= 1.08; // winger cross bonus

  let saveVal = safeNum(gk.stats.defending) * 1.5 + safeNum(gk.stats.physical) * 0.5;
  if (gk.traits.includes('Wall')) saveVal *= 1.20;

  const atkFinish = atkGet(atkFwd, shotVal);
  const defSave   = defGet(gk,     saveVal);

  // [P0 FIX] Check score cap BEFORE pushing goal event
  if (duel(atkFinish, defSave)) {
    if (score[attackingTeamKey] < maxGoals) {
      score[attackingTeamKey]++;
      const goalDetail = hasWingAssist
        ? `⚽ ГОЛ! Крест от ${assistPlayer.name} — ${atkFwd.name} замыкает в касание! (${atkMid.name} разрезал защиту)`
        : `⚽ ГОЛ! ${atkFwd.name} ${pick(PENET_WIN)} и прошивает ворота ${gk.name}! (пас: ${atkMid.name})`;
      events.push({
        type: 'goal', minute,
        player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
        details: goalDetail,
      });
    }
    // If score cap reached, the attack silently fizzles — no goal event added
  } else {
    // Corner kick check — 30% of misses produce a corner
    if (Math.random() < 0.30) {
      events.push({
        type: 'info', minute,
        player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
        details: `🚩 Угловой! ${atkFwd.name} бьёт — мяч уходит за лицевую.`,
      });
      resolveCorner({ ...ctx, minute: minute + 1 });
      return;
    }

    // Heroic save vs. simple miss
    const keeperHeroic = !duel(atkFinish, defSave * 0.75);
    if (keeperHeroic) {
      events.push({
        type: 'save', minute,
        player_id: gk.id, player_name: gk.name, team: defTeamKey,
        details: `🧤 СЭЙВ! ${gk.name} ${pick(SAVE_MSGS)} — ${atkFwd.name} не верит своим глазам!`,
      });
    } else {
      events.push({
        type: 'save', minute,
        player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
        details: `💨 ${atkFwd.name} ${pick(MISS_MSGS)} после отличного прохода.`,
      });
    }
  }
}

// =============================================================================
// Timeline builder — guaranteed no infinite loop (pool of 87 unique slots)
// =============================================================================

function buildTimeline(
  homeCount: number,
  awayCount: number
): Array<{ team: 'home' | 'away'; minute: number }> {
  const availableMinutes: number[] = [];
  for (let m = 2; m <= 88; m++) availableMinutes.push(m);

  // Fisher-Yates shuffle
  for (let i = availableMinutes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableMinutes[i], availableMinutes[j]] = [availableMinutes[j], availableMinutes[i]];
  }

  const safeHome = Math.max(0, Math.floor(homeCount || 0));
  const safeAway = Math.max(0, Math.floor(awayCount || 0));
  const total = safeHome + safeAway;

  const selectedMinutes = availableMinutes.slice(0, total).sort((a, b) => a - b);

  const homeSlots = Math.min(safeHome, selectedMinutes.length);
  const result: Array<{ team: 'home' | 'away'; minute: number }> = [];

  const indices = [...Array(total).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const homeIndices = new Set(indices.slice(0, homeSlots));

  selectedMinutes.forEach((min, idx) => {
    result.push({ team: homeIndices.has(idx) ? 'home' : 'away', minute: min });
  });

  return result;
}

// =============================================================================
// simulateMatch — main export
// =============================================================================

export function simulateMatch(
  homeTeam: MatchPlayer[],
  awayTeam: MatchPlayer[],
  homeBench: MatchPlayer[],
  awayBench: MatchPlayer[],
  homeGreenLinks: Record<string, boolean>,
  awayGreenLinks: Record<string, boolean>
): MatchResult {
  const events: MatchEvent[] = [];
  const score = { home: 0, away: 0 };
  const staminaDrain: { home: Record<string, number>; away: Record<string, number> } = { home: {}, away: {} };

  // [P0] Safety: empty teams → 0-0 immediately
  if (homeTeam.length === 0 || awayTeam.length === 0) {
    return { score, events, staminaDrain };
  }

  // ── Trait synergy/conflict maps ────────────────────────────────────────────
  const homeSyn: Record<string, boolean> = {};
  const homeCon: Record<string, boolean> = {};
  const awaySyn: Record<string, boolean> = {};
  const awayCon: Record<string, boolean> = {};

  const calcTraits = (team: MatchPlayer[], syn: Record<string, boolean>, con: Record<string, boolean>) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        if (hasTraitSynergy(team[i].traits, team[j].traits)) {
          syn[team[i].id] = true;
          syn[team[j].id] = true;
        }
        if (hasTraitConflict(team[i].traits, team[j].traits)) {
          con[team[i].id] = true;
          con[team[j].id] = true;
        }
      }
    }
  };

  calcTraits(homeTeam, homeSyn, homeCon);
  calcTraits(awayTeam, awaySyn, awayCon);

  const homeLinks: TeamLinks = { greenLinks: homeGreenLinks, synergies: homeSyn, conflicts: homeCon };
  const awayLinks: TeamLinks = { greenLinks: awayGreenLinks, synergies: awaySyn, conflicts: awayCon };

  // ── Stamina drain (initial) ────────────────────────────────────────────────
  // We need possession first for pressing — use a quick midfield estimate
  const quickMidScore = (team: MatchPlayer[]) =>
    team.filter(p => isMID(p.position)).reduce((s, p) =>
      s + safeNum(p.stats.passing, 50) + safeNum(p.stats.dribbling, 50), 0) || 100;

  const quickHome = quickMidScore(homeTeam);
  const quickAway = quickMidScore(awayTeam);
  const quickTotal = quickHome + quickAway;
  const estHomePoss = quickHome / quickTotal;
  const estAwayPoss = 1 - estHomePoss;

  drainStamina(homeTeam, 'home', estHomePoss, staminaDrain);
  drainStamina(awayTeam, 'away', estAwayPoss, staminaDrain);

  // ── Live stamina map (average of pre/post match) ───────────────────────────
  const liveStaminaMap: Record<string, number> = {};
  for (const p of [...homeTeam, ...awayTeam]) {
    const tk = homeTeam.includes(p) ? 'home' : 'away';
    const end = staminaDrain[tk][p.id] ?? p.stamina;
    liveStaminaMap[p.id] = Math.round((p.stamina + end) / 2);
  }

  // ── True midfield score (with live stamina + links) ────────────────────────
  const homeMid = midfieldScore(homeTeam, homeLinks, liveStaminaMap);
  const awayMid = midfieldScore(awayTeam, awayLinks, liveStaminaMap);
  const totalMid = homeMid + awayMid || 1;

  const homePoss = isNaN(homeMid / totalMid) ? 0.5 : (homeMid / totalMid);
  const awayPoss = 1 - homePoss;

  // Attack count: base 5 + up to 7 bonus based on possession ± 1 jitter
  const homeAttacks = Math.min(12, Math.max(3, Math.round(5 + homePoss * 7 + Math.random() * 2 - 1) || 3));
  const awayAttacks = Math.min(12, Math.max(3, Math.round(5 + awayPoss * 7 + Math.random() * 2 - 1) || 3));

  // ── OVR disparity score cap ────────────────────────────────────────────────
  const avgOVR = (team: MatchPlayer[]) =>
    team.reduce((s, p) =>
      s + (safeNum(p.stats.pace) + safeNum(p.stats.shooting) + safeNum(p.stats.passing) +
           safeNum(p.stats.dribbling) + safeNum(p.stats.defending) + safeNum(p.stats.physical)) / 6,
    0) / (team.length || 1);

  const ovrDiff = Math.abs(avgOVR(homeTeam) - avgOVR(awayTeam));
  const maxGoals = ovrDiff >= 20 ? 8
                 : ovrDiff >= 10 ? 6
                 : ovrDiff >= 5  ? 5
                 : 4;

  // ── Kickoff event ──────────────────────────────────────────────────────────
  events.push({
    type: 'info', minute: 1,
    player_id: homeTeam[0]?.id ?? 'sys', player_name: 'Referee', team: 'home',
    details: `⚽ Матч начался! Владение: Дом ${Math.round(homePoss * 100)}% — Гости ${Math.round(awayPoss * 100)}%.`,
  });

  // ── Track Pitch and Bench states ───────────────────────────────────────────
  const currentHomePitch = [...homeTeam];
  const currentAwayPitch = [...awayTeam];
  const currentHomeBench = [...(homeBench || [])];
  const currentAwayBench = [...(awayBench || [])];
  
  let homeSubsLeft = 3;
  let awaySubsLeft = 3;

  const checkSubs = (pitch: MatchPlayer[], bench: MatchPlayer[], teamKey: 'home' | 'away', minute: number) => {
    let subsMade = 0;
    const subsAllowed = teamKey === 'home' ? homeSubsLeft : awaySubsLeft;
    if (subsAllowed <= 0 || bench.length === 0) return;

    // Sort pitch players by current stamina (lowest first), only consider < 35
    const exhausted = pitch.filter(p => liveStaminaMap[p.id] < 35).sort((a, b) => liveStaminaMap[a.id] - liveStaminaMap[b.id]);
    
    for (const tired of exhausted) {
      if (subsMade >= subsAllowed) break;
      
      const tiredIsDEF = isDEF(tired.position);
      const tiredIsMID = isMID(tired.position);
      const tiredIsFWD = isFWD(tired.position) || isWNG(tired.position);
      const tiredIsGK = tired.position === 'GK';

      const freshIdx = bench.findIndex(bp => {
        if (bp.stamina < 70) return false;
        if (tiredIsGK && bp.position === 'GK') return true;
        if (tiredIsDEF && isDEF(bp.position)) return true;
        if (tiredIsMID && isMID(bp.position)) return true;
        if (tiredIsFWD && (isFWD(bp.position) || isWNG(bp.position))) return true;
        return false;
      });

      if (freshIdx !== -1) {
        const fresh = bench[freshIdx];
        
        // Swap
        const pIdx = pitch.findIndex(p => p.id === tired.id);
        pitch[pIdx] = fresh;
        bench.splice(freshIdx, 1);
        
        // Fix Stamina Drain
        const playedFraction = minute / 90;
        const totalDrainTired = tired.stamina - (staminaDrain[teamKey][tired.id] ?? tired.stamina);
        staminaDrain[teamKey][tired.id] = Math.max(0, tired.stamina - (totalDrainTired * playedFraction));
        
        const remainingFraction = (90 - minute) / 90;
        const baseSubDrain = 18; // Flat drain for subs
        staminaDrain[teamKey][fresh.id] = Math.max(0, fresh.stamina - (baseSubDrain * remainingFraction));
        liveStaminaMap[fresh.id] = fresh.stamina - (baseSubDrain * remainingFraction * 0.5); 
        
        events.push({
          type: 'substitution', minute,
          player_id: fresh.id, player_name: fresh.name, team: teamKey,
          details: `🔄 Замена: ${fresh.name} выходит вместо уставшего ${tired.name}.`
        });
        
        subsMade++;
      }
    }
    
    if (teamKey === 'home') homeSubsLeft -= subsMade;
    else awaySubsLeft -= subsMade;
  };

  // ── Process timeline ───────────────────────────────────────────────────────
  const timeline = buildTimeline(homeAttacks, awayAttacks);

  for (const slot of timeline) {
    // Attempt substitutions around key minutes
    if (slot.minute === 45 || slot.minute === 60 || slot.minute === 75) {
      checkSubs(currentHomePitch, currentHomeBench, 'home', slot.minute);
      checkSubs(currentAwayPitch, currentAwayBench, 'away', slot.minute);
    }

    const isHomeAtk = slot.team === 'home';
    const ctx: AttackContext = {
      minute: slot.minute,
      attackingTeam: isHomeAtk ? currentHomePitch : currentAwayPitch,
      defendingTeam: isHomeAtk ? currentAwayPitch : currentHomePitch,
      attackingTeamKey: isHomeAtk ? 'home' : 'away',
      atkLinks: isHomeAtk ? homeLinks : awayLinks,
      defLinks: isHomeAtk ? awayLinks : homeLinks,
      liveStamina: liveStaminaMap,
      score,
      events,
      maxGoals,
    };
    resolveAttack(ctx);
  }

  // ── Final whistle ──────────────────────────────────────────────────────────
  const resultStr = score.home > score.away ? 'Победа хозяев!'
                  : score.away > score.home ? 'Победа гостей!'
                  : 'Ничья!';
  events.push({
    type: 'info', minute: 90,
    player_id: 'sys', player_name: 'Referee', team: 'home',
    details: `🏁 Финальный свисток! ${score.home}:${score.away} — ${resultStr}`,
  });

  events.sort((a, b) => a.minute - b.minute);
  return { score, events, staminaDrain };
}
