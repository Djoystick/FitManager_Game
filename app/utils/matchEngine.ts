// =============================================================================
// FitManager Match Engine v5.0 — "Swiss Watch Architecture"
// =============================================================================
// Phase 3 changes (Task 011):
//  [P1] New events: Offside (10%), Crossbar/Post (5%), Own Goal (2%), Penalty Save (35%)
//  [P1] Last-minute Goal: x1.5 finishing multiplier at 85+ min when losing by 1
//  [P1] Match Form: optional homeForm/awayForm params; W-W-W→+5%, L-L-L→-5%
//  [P1] Timeline pacing: weighted distribution (front-loaded + back-loaded attacks)
//
// Phase 2 changes (Task 010):
//  [P1] Dynamic stamina drain by 4 match phases (1.20/1.00/0.85/1.10)
//  [P1] Home Advantage: +5% stats, +1 attack
//  [P1] Momentum: Desperation Push (+10% atk when trailing ≥2), Comfort Zone (-5% atk when leading ≥3)
//  [P1] 6 new traits: Comeback Kid, Clutch, Tireless, Enforcer, Aerial Threat, Dive King
//
// Phase 1 changes (Task 009):
//  [P0] staminaMult() → smooth piecewise linear interpolation (no step jumps)
//  [P0] midfieldScore() → normalized by pool length (quality over quantity)
//  [P0] Attack jitter increased to ±2 for more match pacing variance
//  [P1] 2 yellows = red card; yellow card aggression penalty (-15%)
//  [P1] Red card → opposing team gets +8% attack bonus (numerical advantage)
//  [P1] 6 Tactical Styles: Tiki-Taka, Counter Attack, High Press, Park the Bus, Wing Play, Balanced
//  [P1] Tactical style modifiers on possession, attack count, and wing assist chance
//
// Prior changes (v3.0):
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
  sta: number;
  agi: number;
}

export interface MatchPlayer {
  id: string;
  name: string;
  position: string;
  stats: MatchPlayerStats;
  stamina: number;
  traits: string[];
  morale?: number;
}

export type TacticalStyle = 'Tiki-Taka' | 'Counter Attack' | 'High Press' | 'Park the Bus' | 'Wing Play' | 'Balanced';

export interface MatchEvent {
  type: 'goal' | 'breakthrough_failed' | 'save' | 'yellow_card' | 'second_yellow' | 'red_card' | 'injury' | 'info' | 'substitution' | 'offside' | 'crossbar' | 'own_goal' | 'penalty_save' | 'penalty_goal' | 'penalty_miss';
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
  penalties?: { home: number; away: number } | null;
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
  yellowCards: Map<string, number>;
  hasRedCardBonus: boolean;
  momentumAtkBonus: number;
  momentumDefBonus: number;
  homePitchLevel: number;
}

// =============================================================================
// Internal helpers
// =============================================================================

/** Guard against NaN/null/undefined values from DB. */
function safeNum(val: unknown, fallback = 1): number {
  const n = Number(val);
  if (!isFinite(n)) {
    console.warn('[matchEngine] safeNum fallback triggered for stat:', val);
    return fallback;
  }
  return n;
}

/**
 * Logistic duel — win probability follows an S-curve.
 * P = clamp(sigmoid(k × diff) + bias, 0.05, 0.95)
 *   k = 0.022 → at +10 diff: ~62%; at +20: ~73%; at +40: ~88%
 *   attackerBias = +0.06 slight edge for attacker (was 0.08)
 */
function duel(atkStat: number, defStat: number, attackerBias = 0.06): boolean {
  const a = safeNum(atkStat, 50);
  const d = safeNum(defStat, 50);
  const diff = a - d;
  const raw = 1 / (1 + Math.exp(-0.022 * diff)) + attackerBias;
  const p = Math.min(0.95, Math.max(0.05, raw));
  return Math.random() < p;
}

/**
 * Stamina multiplier — smooth piecewise linear interpolation.
 * No sudden jumps: 75→74 is a gentle slope, not a 5% cliff.
 * Zones: [75–100]=1.0, [30–75] linear 1.0→0.75, [0–30] steep 0.75→0.55
 */
function staminaMult(stamina: number): number {
  const s = Math.max(0, Math.min(100, stamina));
  if (s >= 75) return 1.0;
  if (s >= 30) return 1.0 - ((75 - s) / 45) * 0.25;   // 1.0 → 0.75
  return 0.75 - ((30 - s) / 30) * 0.20;                 // 0.75 → 0.55
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
  hasConflict: boolean = false,
  morale: number = 70,
  traits: string[] = []
): number {
  const base = safeNum(rawStat, 0);
  const stamMult = staminaMult(Math.max(0, currentStamina));

  let buffMult = 1.0;
  if (hasGreenLink) buffMult += 0.10;
  if (hasSynergy)   buffMult += 0.10;
  if (traits.includes('SEASON_AWARD_WINNER')) buffMult += 0.02;
  
  if (morale < 40) buffMult -= 0.10;
  else if (morale > 85) buffMult += 0.05;

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
      links.conflicts[player.id] ?? false,
      player.morale ?? 70,
      player.traits ?? []
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
  if (source.length === 0) {
    // P0 safety: return synthetic dummy player to prevent crash on non-standard formations
    return {
      id: 'synthetic_fallback',
      name: 'Unknown',
      position: 'MID',
      stats: { pace: 1, shooting: 1, passing: 1, dribbling: 1, defending: 1, physical: 1 },
      stamina: 1,
      traits: [],
    } as unknown as T;
  }
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
// Stamina drain — Phase-based intensity + Engine/Tireless traits
// =============================================================================

/** Phase multiplier for stamina drain based on match minute. */
function getPhaseDrainMultiplier(minute: number): number {
  if (minute <= 30)  return 1.20;  // Phase 1: high intensity start
  if (minute <= 60)  return 1.00;  // Phase 2: normal pace
  if (minute <= 75)  return 0.85;  // Phase 3: energy conservation
  return 1.10;                      // Phase 4: final sprint
}

function drainStamina(
  players: MatchPlayer[],
  teamKey: 'home' | 'away',
  possession: number,
  staminaDrain: { home: Record<string, number>; away: Record<string, number> },
  minute: number = 1
) {
  const pressingFactor = possession < 0.40 ? 1.25
                       : possession < 0.50 ? 1.10
                       : 1.00;
  const phaseMult = getPhaseDrainMultiplier(minute);

  for (const p of players) {
    let base = Math.floor(Math.random() * 7) + 16; // 16–22

    if (p.position === 'GK')    base = Math.floor(base * 0.50);
    else if (isMID(p.position)) base = Math.floor(base * 1.15);

    let finalDrain = Math.floor(base * pressingFactor * phaseMult);
    // sta (stamina stat): reduces drain proportionally. 99 sta = -30% drain, 1 sta = 0% reduction
    const staStat = safeNum(p.stats?.sta, 50);
    const staReduction = 0.30 * (staStat / 99);
    finalDrain = Math.floor(finalDrain * (1 - staReduction));
    // Engine trait: -30% drain
    if (p.traits.includes('Engine'))  finalDrain = Math.floor(finalDrain * 0.70);
    // Tireless trait: -40% drain (stacks multiplicatively with Engine)
    if (p.traits.includes('Tireless')) finalDrain = Math.floor(finalDrain * 0.60);

    staminaDrain[teamKey][p.id] = Math.max(0, p.stamina - finalDrain);
  }
}

// =============================================================================
// Midfield Control
// =============================================================================

/**
 * Midfield control score — normalized by pool length so possession is determined
 * by midfield *quality*, not *quantity*. A team with 5 weak MIDs doesn't
 * automatically dominate possession over 3 strong ones.
 */
function midfieldScore(
  players: MatchPlayer[],
  links: TeamLinks,
  liveStamina: Record<string, number>
): number {
  const mids = players.filter(p => isMID(p.position));
  const pool = mids.length > 0 ? mids : players.filter(p => p.position !== 'GK');
  if (pool.length === 0) return 100; // safety fallback

  const get = makeStatGetter(links, liveStamina);
  const rawSum = pool.reduce((sum, p) =>
    sum +
    get(p, safeNum(p.stats.passing, 50)) +
    get(p, safeNum(p.stats.dribbling, 50)) +
    get(p, safeNum(p.stats.physical, 50) * 0.4),
  0);
  return rawSum / pool.length;
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
  // Aerial Threat: +25% to header effectiveness on corners
  const headerFinal = header.traits.includes('Aerial Threat') ? headerEff * 1.25 : headerEff;
  const saveEff   = defGet(gk,     safeNum(gk.stats.defending) * 1.0 + safeNum(gk.stats.physical) * 0.5);

  if (duel(headerFinal, saveEff, 0.0) && score[attackingTeamKey] < maxGoals) {
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

  // Dive King: +5% penalty conversion (higher attackerBias)
  // Penalty Save: ~35% base chance for GK to save (adjusted by GK defending)
  const penBias = atkFwd.traits.includes('Dive King') ? 0.20 : 0.15;
  const gkSaveBonus = (safeNum(gk.stats.defending) - 50) * 0.002; // GK quality modifier
  const penSaveChance = Math.max(0.20, Math.min(0.50, 0.35 - gkSaveBonus));
  const penaltySaved = Math.random() < penSaveChance;

  if (!penaltySaved && duel(shotEff, saveEff, penBias) && score[attackingTeamKey] < maxGoals) {
    score[attackingTeamKey]++;
    events.push({
      type: 'goal', minute: minute + 1,
      player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
      details: `⚽ ГОЛ! ${atkFwd.name} хладнокровно реализует пенальти — вратарь не угадал угол!`,
    });
  } else {
    events.push({
      type: 'penalty_save', minute: minute + 1,
      player_id: gk.id, player_name: gk.name, team: defTeamKey,
      details: `🧤 ПЕНальти ОТРАЖЁН! ${gk.name} угадывает угол и парирует удар ${atkFwd.name}!`,
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
  let atkBuild = atkGet(atkMid, safeNum(atkMid.stats.passing) + safeNum(atkMid.stats.dribbling));
  let defBuild = defGet(defMid, safeNum(defMid.stats.defending) + safeNum(defMid.stats.physical));
  // Momentum: apply attack/defense bonuses from score pressure
  atkBuild *= ctx.momentumAtkBonus;
  defBuild *= ctx.momentumDefBonus;

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
  // agi (agility): +15% to penetration for attacker (dribbling past defender)
  const atkAgi = safeNum(atkFwd.stats?.agi, 50);
  atkPaceVal *= 1 + 0.15 * (atkAgi / 99);
  if (atkFwd.traits.includes('Speedster')) atkPaceVal *= 1.15;
  // Comeback Kid: +15% to all attack stats when team is losing
  const atkTeamTrailing = score[defTeamKey] > score[attackingTeamKey];
  if (atkFwd.traits.includes('Comeback Kid') && atkTeamTrailing) atkPaceVal *= 1.15;

  let defDefVal = safeNum(defDef.stats.defending) + safeNum(defDef.stats.physical);
  // agi (agility): +12% to penetration defense (interception/tackling)
  const defAgi = safeNum(defDef.stats?.agi, 50);
  defDefVal *= 1 + 0.12 * (defAgi / 99);
  if (defDef.traits.includes('Anchor')) defDefVal *= 1.15;
  // Enforcer: +10% to defend duels
  if (defDef.traits.includes('Enforcer')) defDefVal *= 1.10;
  // Comeback Kid: +15% to all defense stats when team is losing
  const defTeamTrailing = score[attackingTeamKey] > score[defTeamKey];
  if (defDef.traits.includes('Comeback Kid') && defTeamTrailing) defDefVal *= 1.15;
  // Yellow card aggression penalty
  const defHasYellow = (ctx.yellowCards.get(defDef.id) ?? 0) > 0;
  if (defHasYellow) defDefVal *= 0.85;
  // Red card numerical advantage
  if (ctx.hasRedCardBonus) {
    atkPaceVal *= 1.08;
    defDefVal *= 0.92;
  }

  const atkPenet = atkGet(atkFwd, atkPaceVal) * ctx.momentumAtkBonus;
  const defPenet = defGet(defDef, defDefVal) * ctx.momentumDefBonus;

  // 3.5% foul chance — Enforcer trait adds +2.5% to foul probability
  const foulChance = defDef.traits.includes('Enforcer') ? 0.06 : 0.035;
  if (Math.random() < foulChance) {
    const isInBox = Math.random() < 0.20; // 20% of fouls are in the penalty area (was 35%)

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
    // P1-2 FIX: Pitch level reduces injury chance by 2% per level (max 15%)
    // Original: yellow=0-0.55, injury=0.55-0.80, red=0.80-1.0
    // With pitch: injury range shrinks, red card range expands
    const injuryReduction = Math.min(0.15, (ctx.homePitchLevel - 1) * 0.02);
    const injuryThreshold = 0.80 - (0.25 * injuryReduction); // 25% base injury range

    if (r < 0.55) {
      // Yellow card — track and check for second yellow
      const prevYellows = ctx.yellowCards.get(defDef.id) ?? 0;
      ctx.yellowCards.set(defDef.id, prevYellows + 1);

      if (prevYellows >= 1) {
        // Second yellow → red card + send off
        events.push({
          type: 'second_yellow', minute,
          player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
          details: `🟡🟡 ВТОРАЯ ЖЁЛТАЯ! ${defDef.name} получает вторую карточку и УДАЛЁН!`,
        });
      } else {
        events.push({
          type: 'yellow_card', minute,
          player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
          details: `🟡 ЖЁЛТАЯ! ${defDef.name} срубает ${atkFwd.name} на подходе к штрафной.`,
        });
      }
    } else if (r < injuryThreshold) {
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

  // ── Offside check (~4% after successful penetration) ──────────────────────
  if (Math.random() < 0.04) {
    events.push({
      type: 'offside', minute,
      player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
      details: `🚩 ОФСАЙД! ${atkFwd.name} забегает за последнего защитника — атака сорвана!`,
    });
    return;
  }

  // ── PHASE 3: Finishing ─────────────────────────────────────────────────────
  let shotVal = safeNum(atkFwd.stats.shooting) * 1.5 + safeNum(atkFwd.stats.pace) * 0.5;
  if (atkFwd.traits.includes('Poacher'))   shotVal *= 1.20;
  if (atkMid.traits.includes('Playmaker')) shotVal *= 1.10;
  if (hasWingAssist)                       shotVal *= 1.08;
  // Clutch: +20% finishing in last 15 minutes (75+ min)
  if (atkFwd.traits.includes('Clutch') && minute >= 75) shotVal *= 1.20;
  // Comeback Kid: +15% finishing when losing
  if (atkFwd.traits.includes('Comeback Kid') && atkTeamTrailing) shotVal *= 1.15;
  // Last-minute Goal: x1.5 finishing if 85+ min and losing by exactly 1 goal
  const losingByOne = score[defTeamKey] - score[attackingTeamKey] === 1;
  if (minute >= 85 && losingByOne) shotVal *= 1.50;

  let saveVal = safeNum(gk.stats.defending) * 1.5 + safeNum(gk.stats.physical) * 0.5;
  if (gk.traits.includes('Wall')) saveVal *= 1.20;

  const atkFinish = atkGet(atkFwd, shotVal) * ctx.momentumAtkBonus;
  const defSave   = defGet(gk,     saveVal) * ctx.momentumDefBonus;

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
  } else {
    // Crossbar / Post check (~5% dramatic miss)
    if (Math.random() < 0.05) {
      events.push({
        type: 'crossbar', minute,
        player_id: atkFwd.id, player_name: atkFwd.name, team: attackingTeamKey,
        details: `🔴 ШАГАНГА! ${atkFwd.name} бьёт — мяч попадает в штангу! Так близко к голу!`,
      });
      return;
    }

    // Own Goal check (~2% when defending team has very low average defending)
    const avgDef = outfieldDef.reduce((s, p) => s + safeNum(p.stats.defending, 50), 0) / (outfieldDef.length || 1);
    if (avgDef < 40 && Math.random() < 0.02 && score[attackingTeamKey] < maxGoals) {
      score[attackingTeamKey]++;
      events.push({
        type: 'own_goal', minute,
        player_id: defDef.id, player_name: defDef.name, team: defTeamKey,
        details: `😱 АВТОГОЛ! ${defDef.name} неудачно обрабатывает мяч после удара ${atkFwd.name} и отправляет его в свои ворота!`,
      });
      return;
    }

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
// Timeline builder — weighted distribution for realistic match pacing
// =============================================================================

/**
 * Builds a timeline of attacks with realistic minute distribution.
 * - Front-loads attacks in first 15 min (high energy)
 * - Increases density in last 15 min (final pushes)
 * - Maintains randomness so it's not entirely predictable
 */
function buildTimeline(
  homeCount: number,
  awayCount: number
): Array<{ team: 'home' | 'away'; minute: number }> {
  const safeHome = Math.max(0, Math.floor(homeCount || 0));
  const safeAway = Math.max(0, Math.floor(awayCount || 0));
  const total = safeHome + safeAway;
  if (total === 0) return [];

  // Build weighted minute pool — higher weight = more likely to be selected
  const minuteWeights: Array<{ minute: number; weight: number }> = [];
  for (let m = 2; m <= 88; m++) {
    let weight = 1.0;
    // Front-load: first 15 minutes get more attacks
    if (m <= 15) weight = 1.5;
    // Mid-game dip: minutes 30–60 are quieter
    else if (m >= 30 && m <= 60) weight = 0.7;
    // Back-load: last 15 minutes get more attacks
    else if (m >= 75) weight = 1.5;
    // Normal zone: minutes 16–29 and 61–74
    else weight = 1.0;

    minuteWeights.push({ minute: m, weight });
  }

  // Weighted sampling without replacement
  const selectedMinutes: number[] = [];
  const pool = [...minuteWeights];
  for (let i = 0; i < total && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalWeight;
    let pickIdx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) { pickIdx = j; break; }
    }
    selectedMinutes.push(pool[pickIdx].minute);
    pool.splice(pickIdx, 1);
  }

  selectedMinutes.sort((a, b) => a - b);

  // Assign home/away randomly
  const indices = [...Array(total).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const homeIndices = new Set(indices.slice(0, safeHome));

  return selectedMinutes.map((min, idx) => ({
    team: homeIndices.has(idx) ? 'home' as const : 'away' as const,
    minute: min,
  }));
}

// =============================================================================
// Penalty Shootout — Cup match tiebreaker
// =============================================================================

/**
 * Simulates a penalty shootout between two teams.
 * Each team takes up to 5 penalties; if still tied, sudden death.
 * Takers are randomly selected from FWD/MID/DEF (best shooting).
 * Formula: (Shooting * 0.7 + Pace * 0.3 + Random) vs (GK_Defending * 0.8 + Physical * 0.2 + Random)
 */
function simulatePenaltyShootout(
  homeTeam: MatchPlayer[],
  awayTeam: MatchPlayer[],
  events: MatchEvent[]
): { home: number; away: number } {
  const homeGK = homeTeam.find(p => p.position === 'GK') ?? homeTeam[0];
  const awayGK = awayTeam.find(p => p.position === 'GK') ?? awayTeam[0];

  // Pick penalty takers: up to 5 from FWD/MID/DEF, sorted by shooting
  const pickShooters = (team: MatchPlayer[]): MatchPlayer[] => {
    const pool = team.filter(p => isFWD(p.position) || isMID(p.position) || isDEF(p.position));
    return pool
      .sort((a, b) => (safeNum(b.stats.shooting) * 0.7 + safeNum(b.stats.pace) * 0.3) -
                       (safeNum(a.stats.shooting) * 0.7 + safeNum(a.stats.pace) * 0.3))
      .slice(0, 5);
  };

  const homeShooters = pickShooters(homeTeam);
  const awayShooters = pickShooters(awayTeam);

  let homeScore = 0;
  let awayScore = 0;
  let round = 0;
  const maxRounds = 5;

  events.push({
    type: 'info', minute: 91,
    player_id: 'sys', player_name: 'Referee', team: 'home',
    details: `⚽ НАЧИНАЕТСЯ СЕРИЯ ПЕНАЛЬТИ! Счёт после основного времени: ${events.filter(e => e.type === 'goal' && e.team === 'home').length}:${events.filter(e => e.type === 'goal' && e.team === 'away').length}`,
  });

  while (round < maxRounds || homeScore === awayScore) {
    // E-10 FIX: hard limit to prevent infinite loop (e.g. both GKs save 100%)
    if (round > 30) break;
    const isSuddenDeath = round >= maxRounds;
    const homeTaker = homeShooters[round % homeShooters.length] ?? homeShooters[0];
    const awayTaker = awayShooters[round % awayShooters.length] ?? awayShooters[0];

    // Home penalty
    if (homeTaker) {
      const shotPower = safeNum(homeTaker.stats.shooting) * 0.7 + safeNum(homeTaker.stats.pace) * 0.3 + (Math.random() * 20 - 10);
      const gkPower = safeNum(awayGK.stats.defending) * 0.8 + safeNum(awayGK.stats.physical) * 0.2 + (Math.random() * 15 - 7.5);

      if (shotPower > gkPower) {
        homeScore++;
        events.push({
          type: 'penalty_goal', minute: 91 + round,
          player_id: homeTaker.id, player_name: homeTaker.name, team: 'home',
          details: `⚽ ПЕНАЛЬТИ ЗАБИТ! ${homeTaker.name} реализует! (${homeScore}:${awayScore})`,
        });
      } else {
        events.push({
          type: 'penalty_miss', minute: 91 + round,
          player_id: homeTaker.id, player_name: homeTaker.name, team: 'home',
          details: `❌ ПЕНАЛЬТИ НЕ ЗАБИТ! ${homeTaker.name} промахивается! (${homeScore}:${awayScore})`,
        });
      }
    }

    // Away penalty
    if (awayTaker) {
      const shotPower = safeNum(awayTaker.stats.shooting) * 0.7 + safeNum(awayTaker.stats.pace) * 0.3 + (Math.random() * 20 - 10);
      const gkPower = safeNum(homeGK.stats.defending) * 0.8 + safeNum(homeGK.stats.physical) * 0.2 + (Math.random() * 15 - 7.5);

      if (shotPower > gkPower) {
        awayScore++;
        events.push({
          type: 'penalty_goal', minute: 91 + round + 0.5,
          player_id: awayTaker.id, player_name: awayTaker.name, team: 'away',
          details: `⚽ ПЕНАЛЬТИ ЗАБИТ! ${awayTaker.name} реализует! (${homeScore}:${awayScore})`,
        });
      } else {
        events.push({
          type: 'penalty_miss', minute: 91 + round + 0.5,
          player_id: awayTaker.id, player_name: awayTaker.name, team: 'away',
          details: `❌ ПЕНАЛЬТИ НЕ ЗАБИТ! ${awayTaker.name} промахивается! (${homeScore}:${awayScore})`,
        });
      }
    }

    // Check early termination (if one team can't catch up)
    if (round < maxRounds - 1) {
      const homeRemaining = maxRounds - (round + 1);
      if (homeScore > awayScore + homeRemaining) break;
      if (awayScore > homeScore + homeRemaining) break;
    }

    round++;

    // Sudden death: if after 5 rounds still tied, continue one-by-one
    if (round >= maxRounds && homeScore === awayScore) {
      events.push({
        type: 'info', minute: 96,
        player_id: 'sys', player_name: 'Referee', team: 'home',
        details: `⚡ ВНЕЗАПНАЯ СМЕРТЬ! Счёт ${homeScore}:${awayScore} — продолжаем!`,
      });
    }
  }

  const winner = homeScore > awayScore ? 'home' : 'away';
  events.push({
    type: 'info', minute: 99,
    player_id: 'sys', player_name: 'Referee', team: 'home',
    details: `🏆 ПОБЕДА В СЕРИИ ПЕНАЛЬТИ: ${winner === 'home' ? events[0]?.details.includes('🏠') ? 'Home' : 'Home' : 'Away'} ${homeScore}:${awayScore}!`,
  });

  return { home: homeScore, away: awayScore };
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
  awayGreenLinks: Record<string, boolean>,
  homeTactic: TacticalStyle = 'Balanced',
  awayTactic: TacticalStyle = 'Balanced',
  homeForm: string[] = [],
  awayForm: string[] = [],
  isCupMatch: boolean = false,
  homePitchLevel: number = 1
): MatchResult {
  const events: MatchEvent[] = [];
  const score = { home: 0, away: 0 };
  const staminaDrain: { home: Record<string, number>; away: Record<string, number> } = { home: {}, away: {} };
  const yellowCards = new Map<string, number>();

  // [P0] Safety: empty teams → 0-0 immediately
  if (homeTeam.length === 0 || awayTeam.length === 0) {
    return { score, events, staminaDrain };
  }

  // ── Match Form bonuses ─────────────────────────────────────────────────────
  const calcFormBonus = (form: string[]): number => {
    if (form.length < 3) return 0;
    const last3 = form.slice(-3);
    if (last3.every(r => r === 'W')) return 1.05;  // Confidence Boost: +5%
    if (last3.every(r => r === 'L')) return 0.95;  // Tilt penalty: -5%
    return 0;
  };
  const homeFormBonus = calcFormBonus(homeForm);
  const awayFormBonus = calcFormBonus(awayForm);

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

  // ── Home Advantage — +5% to all stats for home team ───────────────────────
  const homeAdvBonus = 1.05;

  // ── True midfield score (with live stamina + links) ────────────────────────
  const homeMid = midfieldScore(homeTeam, homeLinks, liveStaminaMap) * homeAdvBonus * (homeFormBonus || 1);
  const awayMid = midfieldScore(awayTeam, awayLinks, liveStaminaMap) * (awayFormBonus || 1);
  const totalMid = homeMid + awayMid || 1;

  let homePoss = isNaN(homeMid / totalMid) ? 0.5 : (homeMid / totalMid);
  let awayPoss = 1 - homePoss;

  // ── Tactical style modifiers (Phase 1) ─────────────────────────────────────
  const getTacticPossMod = (t: TacticalStyle): number => {
    switch (t) {
      case 'Tiki-Taka':      return 0.15;
      case 'Counter Attack':  return -0.10;
      case 'High Press':      return 0.05;
      case 'Park the Bus':    return -0.15;
      case 'Wing Play':       return 0.05;
      case 'Balanced':        return 0;
    }
  };
  const getTacticAttackMod = (t: TacticalStyle): number => {
    switch (t) {
      case 'Tiki-Taka':      return -1;
      case 'Counter Attack':  return 2;
      case 'High Press':      return 1;
      case 'Park the Bus':    return -2;
      case 'Wing Play':       return 0;
      case 'Balanced':        return 0;
    }
  };

  homePoss = Math.max(0.15, Math.min(0.85, homePoss + getTacticPossMod(homeTactic)));
  awayPoss = 1 - homePoss;

  // Attack count: base 3 + possession bonus ± jitter + tactic modifier (reduced for realistic scoring)
  let homeAttackBase = 3 + homePoss * 4 + Math.random() * 3 - 1.5 + getTacticAttackMod(homeTactic) * 0.5;
  let awayAttackBase = 3 + awayPoss * 4 + Math.random() * 3 - 1.5 + getTacticAttackMod(awayTactic) * 0.5;
  // Home advantage: +0.5 attack
  homeAttackBase += 0.5;
  // Form bonus: ±0.3 attack (rounded)
  if (homeFormBonus === 1.05) homeAttackBase += 0.3;
  if (homeFormBonus === 0.95) homeAttackBase -= 0.3;
  if (awayFormBonus === 1.05) awayAttackBase += 0.3;
  if (awayFormBonus === 0.95) awayAttackBase -= 0.3;
  const homeAttacks = Math.min(6, Math.max(3, Math.round(homeAttackBase) || 3));
  const awayAttacks = Math.min(6, Math.max(3, Math.round(awayAttackBase) || 3));

  // ── OVR disparity score cap ────────────────────────────────────────────────
  const avgOVR = (team: MatchPlayer[]) =>
    team.reduce((s, p) =>
      s + (safeNum(p.stats.pace) + safeNum(p.stats.shooting) + safeNum(p.stats.passing) +
           safeNum(p.stats.dribbling) + safeNum(p.stats.defending) + safeNum(p.stats.physical)) / 6,
    0) / (team.length || 1);

  const ovrDiff = Math.abs(avgOVR(homeTeam) - avgOVR(awayTeam));
  const maxGoals = ovrDiff >= 30 ? 5
                 : ovrDiff >= 15 ? 4
                 : ovrDiff >= 5  ? 3
                 : 2;

  // ── Kickoff event ──────────────────────────────────────────────────────────
  events.push({
    type: 'info', minute: 1,
    player_id: homeTeam[0]?.id ?? 'sys', player_name: 'Referee', team: 'home',
    details: `⚽ Матч начался! Тактика: Дом [${homeTactic}] — Гости [${awayTactic}]. Владение: ${Math.round(homePoss * 100)}% — ${Math.round(awayPoss * 100)}%.`,
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
  let homeRedCards = 0;
  let awayRedCards = 0;

  for (const slot of timeline) {
    // Attempt substitutions around key minutes
    if (slot.minute === 45 || slot.minute === 60 || slot.minute === 75) {
      checkSubs(currentHomePitch, currentHomeBench, 'home', slot.minute);
      checkSubs(currentAwayPitch, currentAwayBench, 'away', slot.minute);
    }

    const isHomeAtk = slot.team === 'home';
    const defTeamKey: 'home' | 'away' = isHomeAtk ? 'away' : 'home';
    const defRedCount = isHomeAtk ? awayRedCards : homeRedCards;
    const prevEventCount = events.length;

    // ── Momentum: score pressure bonuses ─────────────────────────────────────
    const homeGoalDiff = score.home - score.away;
    const atkGoalDiff = isHomeAtk ? homeGoalDiff : -homeGoalDiff;
    // Desperation Push: trailing by ≥2 goals → +10% attack bonus
    const momentumAtkBonus = atkGoalDiff <= -2 ? 1.10 : 1.0;
    // Comfort Zone: leading by ≥3 goals → -5% attack penalty
    const momentumAtkPenalty = atkGoalDiff >= 3 ? 0.95 : 1.0;
    const finalAtkBonus = momentumAtkBonus * momentumAtkPenalty;
    // Defending team gets inverse: if THEY are desperate, they defend harder
    const defGoalDiff = -atkGoalDiff;
    const momentumDefBonus = defGoalDiff <= -2 ? 1.05 : 1.0;

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
      yellowCards,
      hasRedCardBonus: defRedCount > 0,
      momentumAtkBonus: finalAtkBonus,
      momentumDefBonus,
      homePitchLevel,
    };
    resolveAttack(ctx);

    // Detect new red/second-yellow cards and handle send-offs
    for (let i = prevEventCount; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'red_card' || ev.type === 'second_yellow') {
        const isHome = ev.team === 'home';
        if (isHome) homeRedCards++;
        else awayRedCards++;

        // Remove sent-off player from pitch
        const pitch = isHome ? currentHomePitch : currentAwayPitch;
        const bench = isHome ? currentHomeBench : currentAwayBench;
        const teamKey: 'home' | 'away' = isHome ? 'home' : 'away';
        const pIdx = pitch.findIndex(p => p.id === ev.player_id);
        if (pIdx !== -1) {
          const sentOff = pitch[pIdx];
          // Try auto-sub if bench has a matching position player
          const subIdx = bench.findIndex(bp => {
            if (isDEF(sentOff.position) && isDEF(bp.position)) return true;
            if (isMID(sentOff.position) && isMID(bp.position)) return true;
            if ((isFWD(sentOff.position) || isWNG(sentOff.position)) && (isFWD(bp.position) || isWNG(bp.position))) return true;
            return false;
          });
          if (subIdx !== -1) {
            const sub = bench[subIdx];
            pitch[pIdx] = sub;
            bench.splice(subIdx, 1);
            const remainingFraction = (90 - slot.minute) / 90;
            staminaDrain[teamKey][sub.id] = Math.max(0, sub.stamina - (18 * remainingFraction));
            liveStaminaMap[sub.id] = sub.stamina - (18 * remainingFraction * 0.5);
            events.push({
              type: 'substitution', minute: slot.minute,
              player_id: sub.id, player_name: sub.name, team: teamKey,
              details: `🔄 Замена после удаления: ${sub.name} выходит вместо ${sentOff.name}.`
            });
            if (teamKey === 'home') homeSubsLeft = Math.max(0, homeSubsLeft - 1);
            else awaySubsLeft = Math.max(0, awaySubsLeft - 1);
          } else {
            // No matching sub — remove player, team plays with 10
            pitch.splice(pIdx, 1);
          }
        }
      }
    }
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

  // ── Penalty Shootout (Cup matches only, if tied) ─────────────────────────
  let penalties: { home: number; away: number } | null = null;
  if (isCupMatch && score.home === score.away) {
    penalties = simulatePenaltyShootout(homeTeam, awayTeam, events);
  }

  events.sort((a, b) => a.minute - b.minute);
  return { score, events, staminaDrain, penalties };
}
