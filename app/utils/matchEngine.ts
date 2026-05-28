// =============================================================================
// FitManager Match Engine v2.1 — "Micro-Duel Architecture" (HOTFIX)
// =============================================================================
// HOTFIX over v2.0:
//  1. FIXED: Infinite minute loop — deduplication now uses a bounded approach
//     that never increments past minute 89. Max 89 unique slots guaranteed.
//  2. FIXED: Attack minimums — Math.max(5, ...) guarantees at least 5 attacks
//     per team so events are always generated.
//  3. FIXED: Added kickoff (min 1) and final whistle (min 90) info events so
//     the events array is never empty.
//  4. FIXED: Attack count hard-capped at 12 per team to prevent runaway scoring.
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
  type: 'goal' | 'breakthrough_failed' | 'save' | 'yellow_card' | 'red_card' | 'injury' | 'info';
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

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Biased dice roll. The better stat wins ~72% of duels at +10 advantage.
 * Noise window: ±15. At +30 advantage the stronger stat wins ~100%.
 */
function duel(atkStat: number, defStat: number): boolean {
  const atkRoll = atkStat + (Math.random() * 30 - 15);
  const defRoll = defStat + (Math.random() * 30 - 15);
  return atkRoll > defRoll;
}

/** Stamina multiplier — linear above 50, steep penalty below 25. */
function staminaMult(stamina: number): number {
  if (stamina >= 75) return 1.00;
  if (stamina >= 50) return 0.95;
  if (stamina >= 35) return 0.88;
  if (stamina >= 25) return 0.78;
  return 0.60;
}

/** Effective stat value: applies stamina penalty and chemistry bonus. */
function eff(
  rawStat: number,
  hasGreenLink: boolean,
  currentStamina: number
): number {
  let val = rawStat * staminaMult(currentStamina);
  if (hasGreenLink) val *= 1.10;
  return val;
}

/** Pick a random element from a non-empty array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Position group predicates
const isMID = (pos: string) => ['MID', 'CM', 'CAM', 'CDM', 'RM', 'LM'].includes(pos || '');
const isFWD = (pos: string) => ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM'].includes(pos || '');
const isWNG = (pos: string) => ['RM', 'LM', 'LWF', 'RWF'].includes(pos || '');
const isDEF = (pos: string) => ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(pos || '');

// =============================================================================
// Stamina drain
// =============================================================================

function drainStamina(
  players: MatchPlayer[],
  teamKey: 'home' | 'away',
  staminaDrain: { home: Record<string, number>; away: Record<string, number> }
) {
  for (const p of players) {
    let drain = Math.floor(Math.random() * 11) + 16; // 16–26
    if (p.traits.includes('Engine')) drain = Math.max(8, drain - 6);
    staminaDrain[teamKey][p.id] = Math.max(0, p.stamina - drain);
  }
}

// =============================================================================
// Midfield Control
// =============================================================================

function midfieldScore(
  players: MatchPlayer[],
  greenLinks: Record<string, boolean>,
  liveStamina: Record<string, number>
): number {
  const mids = players.filter(p => isMID(p.position));
  const pool = mids.length > 0 ? mids : players.filter(p => p.position !== 'GK');
  if (pool.length === 0) return 100; // safety fallback

  return pool.reduce((sum, p) => {
    const st = liveStamina[p.id] ?? p.stamina;
    const gl = greenLinks[p.id] ?? false;
    return (
      sum +
      eff(p.stats.passing,          gl, st) +
      eff(p.stats.dribbling,        gl, st) +
      eff(p.stats.physical * 0.4,   gl, st)
    );
  }, 0);
}

// =============================================================================
// Narrative pools
// =============================================================================

const BUILDUP_LOSE = [
  'loses the ball in midfield',
  'is dispossessed before reaching the final third',
  'misplaces the pass under pressure',
  'tackled cleanly — the move breaks down',
];
const PENET_WIN = [
  'bursts past the last defender',
  'leaves the defender in the dust with a brilliant feint',
  'accelerates into the box',
  'dribbles around two defenders',
];
const PENET_LOSE = [
  'is tracked and stopped by a brilliant tackle',
  'runs into a wall of defenders',
  'hesitates and loses the ball near the box',
  'is shoulder-barged off the ball',
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
// Attack resolver
// =============================================================================

interface AttackContext {
  attackingTeam: MatchPlayer[];
  defendingTeam: MatchPlayer[];
  atkKey: 'home' | 'away';
  defKey: 'home' | 'away';
  atkGreenLinks: Record<string, boolean>;
  defGreenLinks: Record<string, boolean>;
  liveStamina: Record<string, number>;
  minute: number;
  events: MatchEvent[];
  score: { home: number; away: number };
}

function resolveAttack(ctx: AttackContext): void {
  const { attackingTeam, defendingTeam, atkKey, defKey, atkGreenLinks, defGreenLinks, liveStamina, minute, events, score } = ctx;

  // ── Role selection with safe fallbacks ─────────────────────────────────────
  const outfieldAtk  = attackingTeam.filter(p => p.position !== 'GK');
  const outfieldDef  = defendingTeam.filter(p => p.position !== 'GK');

  const atkMidPool   = attackingTeam.filter(p => isMID(p.position));
  const defMidPool   = defendingTeam.filter(p => isMID(p.position));
  const atkFwdPool   = attackingTeam.filter(p => isFWD(p.position) || isWNG(p.position));
  const defDefPool   = defendingTeam.filter(p => isDEF(p.position));
  const gk           = defendingTeam.find(p => p.position === 'GK');

  const atkMid  = atkMidPool.length > 0  ? pick(atkMidPool)  : pick(outfieldAtk);
  const defMid  = defMidPool.length > 0  ? pick(defMidPool)  : pick(outfieldDef);
  const atkFwd  = atkFwdPool.length > 0  ? pick(atkFwdPool)  : atkMid;
  const defDef  = defDefPool.length > 0  ? pick(defDefPool)  : defMid;
  const keeper  = gk ?? pick(defendingTeam);

  const st = (p: MatchPlayer) => liveStamina[p.id] ?? p.stamina;
  const gl = (p: MatchPlayer, links: Record<string, boolean>) => links[p.id] ?? false;

  // ── PHASE 1: Build-up ──────────────────────────────────────────────────────
  const atkBuild = eff(atkMid.stats.passing + atkMid.stats.dribbling, gl(atkMid, atkGreenLinks), st(atkMid));
  const defBuild = eff(defMid.stats.defending + defMid.stats.physical, gl(defMid, defGreenLinks), st(defMid));

  if (!duel(atkBuild, defBuild)) {
    events.push({
      type: 'breakthrough_failed',
      minute,
      player_id: defMid.id,
      player_name: defMid.name,
      team: defKey,
      details: `${atkMid.name} ${pick(BUILDUP_LOSE)}. ${defMid.name} wins the ball back.`,
    });
    return;
  }

  // ── PHASE 2: Penetration ───────────────────────────────────────────────────
  let atkPaceVal = atkFwd.stats.pace + atkFwd.stats.dribbling;
  let defStopVal = defDef.stats.pace + defDef.stats.defending;
  if (atkFwd.traits.includes('Sniper'))   atkPaceVal += 5;
  if (atkFwd.traits.includes('Paceman'))  atkPaceVal += 7;
  if (defDef.traits.includes('Wall'))     defStopVal += 8;

  // 5% foul chance — fires and stops the attack
  if (Math.random() < 0.05) {
    const r = Math.random();
    if (r < 0.55) {
      events.push({ type: 'yellow_card', minute, player_id: defDef.id, player_name: defDef.name, team: defKey, details: `🟡 ЖЁЛТАЯ! ${defDef.name} срубает ${atkFwd.name} на подходе к штрафной.` });
    } else if (r < 0.80) {
      events.push({ type: 'injury', minute, player_id: atkFwd.id, player_name: atkFwd.name, team: atkKey, details: `🚑 ТРАВМА! ${atkFwd.name} получает повреждение в стыке с ${defDef.name}.` });
    } else {
      events.push({ type: 'red_card', minute, player_id: defDef.id, player_name: defDef.name, team: defKey, details: `🔴 КРАСНАЯ! ${defDef.name} удалён за фол последней надежды на ${atkFwd.name}!` });
    }
    return;
  }

  const atkPace = eff(atkPaceVal, gl(atkFwd, atkGreenLinks), st(atkFwd));
  const defStop = eff(defStopVal, gl(defDef, defGreenLinks), st(defDef));

  if (!duel(atkPace, defStop)) {
    events.push({
      type: 'breakthrough_failed',
      minute,
      player_id: defDef.id,
      player_name: defDef.name,
      team: defKey,
      details: `${atkFwd.name} ${pick(PENET_LOSE)}. ${defDef.name} reads the run perfectly.`,
    });
    return;
  }

  // ── PHASE 3: Finishing ─────────────────────────────────────────────────────
  let shotVal = atkFwd.stats.shooting + atkFwd.stats.physical * 0.3;
  let saveVal = keeper.stats.defending + keeper.stats.physical;
  if (atkFwd.traits.includes('Sniper'))    shotVal += 10;
  if (keeper.traits.includes('Wall'))      saveVal += 8;
  if (keeper.traits.includes('Reflexes'))  saveVal += 6;

  const atkShot = eff(shotVal, gl(atkFwd, atkGreenLinks), st(atkFwd));
  const defSave = eff(saveVal, gl(keeper, defGreenLinks),  st(keeper));

  if (duel(atkShot, defSave)) {
    score[atkKey]++;
    events.push({
      type: 'goal',
      minute,
      player_id: atkFwd.id,
      player_name: atkFwd.name,
      team: atkKey,
      details: `⚽ ГОЛ! ${atkFwd.name} ${pick(PENET_WIN)} и прошивает ворота ${keeper.name}! (пас: ${atkMid.name})`,
    });
  } else {
    const keeperHeroic = !duel(atkShot, defSave * 0.75);
    if (keeperHeroic) {
      events.push({
        type: 'save',
        minute,
        player_id: keeper.id,
        player_name: keeper.name,
        team: defKey,
        details: `🧤 СЭЙВ! ${keeper.name} ${pick(SAVE_MSGS)} ${atkFwd.name} не верит своим глазам!`,
      });
    } else {
      events.push({
        type: 'save',
        minute,
        player_id: atkFwd.id,
        player_name: atkFwd.name,
        team: atkKey,
        details: `💨 ${atkFwd.name} ${pick(MISS_MSGS)} после отличного прохода.`,
      });
    }
  }
}

// =============================================================================
// Timeline builder — FIXED: no infinite loop past minute 89
// =============================================================================

/**
 * Distribute N attacks across minutes 2–89.
 * Uses pre-assigned unique slots from a shuffled pool — guarantees no loop.
 */
function buildTimeline(
  homeCount: number,
  awayCount: number
): Array<{ team: 'home' | 'away'; minute: number }> {
  // Create a pool of available minutes (2 to 88 inclusive = 87 slots)
  const availableMinutes: number[] = [];
  for (let m = 2; m <= 88; m++) availableMinutes.push(m);

  // Fisher-Yates shuffle
  for (let i = availableMinutes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableMinutes[i], availableMinutes[j]] = [availableMinutes[j], availableMinutes[i]];
  }

  const safeHomeCount = Math.max(0, Math.floor(homeCount || 0));
  const safeAwayCount = Math.max(0, Math.floor(awayCount || 0));
  const total = safeHomeCount + safeAwayCount;
  
  // Take only as many slots as we have attacks (pool has 87 — always enough)
  const selectedMinutes = availableMinutes.slice(0, total).sort((a, b) => a - b);

  // Assign teams: interleave home/away proportionally
  const homeSlots = Math.min(safeHomeCount, selectedMinutes.length);
  const result: Array<{ team: 'home' | 'away'; minute: number }> = [];

  // Shuffle which indices go to home vs away
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
  homeGreenLinks: Record<string, boolean>,
  awayGreenLinks: Record<string, boolean>
): MatchResult {
  const events: MatchEvent[] = [];
  const score = { home: 0, away: 0 };
  const staminaDrain: { home: Record<string, number>; away: Record<string, number> } = { home: {}, away: {} };

  // Safety: if teams are empty, return a boring 0-0 immediately
  if (homeTeam.length === 0 || awayTeam.length === 0) {
    return { score, events, staminaDrain };
  }

  // ── 1. Stamina drain ───────────────────────────────────────────────────────
  drainStamina(homeTeam, 'home', staminaDrain);
  drainStamina(awayTeam, 'away', staminaDrain);

  // Live stamina = midpoint of start and end (simulates gradual fatigue)
  const liveStaminaMap: Record<string, number> = {};
  for (const p of [...homeTeam, ...awayTeam]) {
    const tk = homeTeam.includes(p) ? 'home' : 'away';
    const end = staminaDrain[tk][p.id] ?? p.stamina;
    liveStaminaMap[p.id] = Math.round((p.stamina + end) / 2);
  }

  // ── 2. Possession / attack count ──────────────────────────────────────────
  const homeMid  = midfieldScore(homeTeam, homeGreenLinks, liveStaminaMap);
  const awayMid  = midfieldScore(awayTeam, awayGreenLinks, liveStaminaMap);
  const totalMid = homeMid + awayMid || 1; // avoid division by zero

  const homePoss = homeMid / totalMid;
  const awayPoss = 1 - homePoss;

  // Formula: base 5 attacks + up to 7 bonus based on possession, ±1 jitter
  // Capped at 12 max per team (hard cap to prevent runaway goals)
  // Minimum 5 per team to guarantee events
  const homeAttacks = Math.min(12, Math.max(5, Math.round(5 + homePoss * 7 + Math.random() * 2 - 1)));
  const awayAttacks = Math.min(12, Math.max(5, Math.round(5 + awayPoss * 7 + Math.random() * 2 - 1)));

  // ── 3. Kickoff info event ──────────────────────────────────────────────────
  const homeAnchor = homeTeam[0];
  const awayAnchor = awayTeam[0];
  events.push({
    type: 'info',
    minute: 1,
    player_id: homeAnchor?.id ?? 'sys',
    player_name: 'Referee',
    team: 'home',
    details: `⚽ Матч начался! Владение мячом: Дом ${Math.round(homePoss * 100)}% — Гости ${Math.round(awayPoss * 100)}%.`,
  });

  // ── 4. Build & process timeline ────────────────────────────────────────────
  const timeline = buildTimeline(homeAttacks, awayAttacks);

  for (const slot of timeline) {
    if (slot.team === 'home') {
      resolveAttack({ attackingTeam: homeTeam, defendingTeam: awayTeam, atkKey: 'home', defKey: 'away', atkGreenLinks: homeGreenLinks, defGreenLinks: awayGreenLinks, liveStamina: liveStaminaMap, minute: slot.minute, events, score });
    } else {
      resolveAttack({ attackingTeam: awayTeam, defendingTeam: homeTeam, atkKey: 'away', defKey: 'home', atkGreenLinks: awayGreenLinks, defGreenLinks: homeGreenLinks, liveStamina: liveStaminaMap, minute: slot.minute, events, score });
    }
  }

  // ── 5. Score cap by OVR disparity ─────────────────────────────────────────
  const avgOVR = (team: MatchPlayer[]) =>
    team.reduce((s, p) => s + (p.stats.pace + p.stats.shooting + p.stats.passing + p.stats.dribbling + p.stats.defending + p.stats.physical) / 6, 0) / (team.length || 1);

  const ovrDiff = Math.abs(avgOVR(homeTeam) - avgOVR(awayTeam));
  const maxGoals = ovrDiff >= 20 ? 99 : ovrDiff >= 10 ? 6 : ovrDiff >= 5 ? 5 : 4;
  score.home = Math.min(score.home, maxGoals);
  score.away = Math.min(score.away, maxGoals);

  // ── 6. Final whistle event ─────────────────────────────────────────────────
  const resultStr = score.home > score.away ? 'Победа хозяев!' : score.away > score.home ? 'Победа гостей!' : 'Ничья!';
  events.push({
    type: 'info',
    minute: 90,
    player_id: 'sys',
    player_name: 'Referee',
    team: 'home',
    details: `🏁 Финальный свисток! ${score.home}:${score.away} — ${resultStr}`,
  });

  // ── 7. Sort by minute ──────────────────────────────────────────────────────
  events.sort((a, b) => a.minute - b.minute);

  return { score, events, staminaDrain };
}
