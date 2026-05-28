// =============================================================================
// FitManager Match Engine v2.0 — "Micro-Duel Architecture"
// =============================================================================
// Architecture: 3-Phase micro-duel system per attack sequence.
//   Phase 1 — Build-up:   Attacker MID passing+dribbling vs Defender MID defending+physical
//   Phase 2 — Penetration: FWD/WNG pace+dribbling vs DEF pace+defending
//   Phase 3 — Finishing:  FWD shooting vs GK physical+defending
//
// Key modifiers:
//  • Chemistry (greenLinks): +10% to all effective stats
//  • Stamina degradation:    linear penalty below 50 stamina, severe below 25
//  • Trait bonuses:          applied per phase (see TRAIT_CONFIG)
//  • RNG dice:               biased — better stat wins ~72% of duels
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

/** Biased dice roll: adds random noise to a stat comparison. The better stat
 *  wins ~72% of duels when it is 10+ points ahead (logistic-like distribution). */
function duel(atkStat: number, defStat: number): boolean {
  // Add symmetric noise in [-15, +15]
  const atkRoll = atkStat + (Math.random() * 30 - 15);
  const defRoll = defStat + (Math.random() * 30 - 15);
  return atkRoll > defRoll;
}

/** Stamina multiplier — linear above 50, steep penalty below 25. */
function staminaMult(stamina: number): number {
  if (stamina >= 75) return 1.0;
  if (stamina >= 50) return 0.95;
  if (stamina >= 35) return 0.88;
  if (stamina >= 25) return 0.78;
  return 0.60; // exhausted
}

/** Get an effective stat for a player factoring in stamina and chemistry. */
function eff(
  player: MatchPlayer,
  rawStat: number,
  hasGreenLink: boolean,
  currentStamina: number
): number {
  let val = rawStat * staminaMult(currentStamina);
  if (hasGreenLink) val *= 1.10;
  return val;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Position group predicates
const isMID = (pos: string) =>
  ['MID', 'CM', 'CAM', 'CDM', 'RM', 'LM'].includes(pos || '');
const isFWD = (pos: string) =>
  ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM'].includes(pos || '');
const isWNG = (pos: string) =>
  ['RM', 'LM', 'LWF', 'RWF'].includes(pos || '');
const isDEF = (pos: string) =>
  ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(pos || '');

// =============================================================================
// Stamina drain calculation
// =============================================================================

/** Calculate in-game stamina drain. Engine trait reduces drain by 5. */
function drainStamina(
  players: MatchPlayer[],
  teamKey: 'home' | 'away',
  staminaDrain: { home: Record<string, number>; away: Record<string, number> }
) {
  for (const p of players) {
    let drain = Math.floor(Math.random() * 11) + 16; // base: 16–26
    if (p.traits.includes('Engine')) drain = Math.max(8, drain - 6);
    staminaDrain[teamKey][p.id] = Math.max(0, p.stamina - drain);
  }
}

// =============================================================================
// Midfield Control (Possession)
// =============================================================================

/** Compute Midfield Dominance score for a team.
 *  Uses: passing + dribbling (weighted by physical for duels). */
function midfieldScore(
  players: MatchPlayer[],
  teamKey: 'home' | 'away',
  greenLinks: Record<string, boolean>,
  liveStamina: Record<string, number>
): number {
  const mids = players.filter(p => isMID(p.position));
  // Fallback: if no dedicated mids, use all outfield players
  const pool = mids.length > 0 ? mids : players.filter(p => p.position !== 'GK');

  return pool.reduce((sum, p) => {
    const st = liveStamina[p.id] ?? p.stamina;
    const gl = greenLinks[p.id] ?? false;
    return (
      sum +
      eff(p, p.stats.passing, gl, st) +
      eff(p, p.stats.dribbling, gl, st) +
      eff(p, p.stats.physical * 0.4, gl, st)
    );
  }, 0);
}

// =============================================================================
// Narrative pool
// =============================================================================

const BUILDUP_WIN  = ['carves open the defence with a laser pass', 'threads the ball through midfield perfectly', 'wins possession and starts the counter-attack', 'nutmegs the midfielder and drives forward'];
const BUILDUP_LOSE = ['loses the ball in midfield', 'is dispossessed before reaching the final third', 'misplaces the pass under pressure', 'tackled cleanly, the move breaks down'];
const PENET_WIN    = ['bursts past the last man', 'leaves the defender in the dust with a feint', 'accelerates into the box', 'dribbles around two defenders'];
const PENET_LOSE   = ['is tracked and stopped by a brilliant tackle', 'runs into a wall of defenders', 'hesitates and loses the ball near the box', 'shoulder-barged off the ball'];
const SAVE_MSGS    = ['makes a brilliant save!', 'tips the ball over the bar with fingertips!', 'dives full-stretch to deny the goal!', 'parries away a thunderous effort!'];
const MISS_MSGS    = ['blazes over the bar', 'fires wide from a great position', 'hits the post', 'drags the shot just outside the far post'];

// =============================================================================
// Core attack resolver
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
  const {
    attackingTeam, defendingTeam,
    atkKey, defKey,
    atkGreenLinks, defGreenLinks,
    liveStamina, minute, events, score
  } = ctx;

  // ── Select role-players ────────────────────────────────────────────────────
  const atkMids  = attackingTeam.filter(p => isMID(p.position));
  const defMids  = defendingTeam.filter(p => isMID(p.position));
  const atkFwds  = attackingTeam.filter(p => isFWD(p.position) || isWNG(p.position));
  const defDefs  = defendingTeam.filter(p => isDEF(p.position));
  const gk       = defendingTeam.find(p => p.position === 'GK');

  // Fallbacks
  const atkMid  = atkMids.length > 0 ? pick(atkMids)  : pick(attackingTeam.filter(p => p.position !== 'GK'));
  const defMid  = defMids.length > 0 ? pick(defMids)  : pick(defendingTeam.filter(p => p.position !== 'GK'));
  const atkFwd  = atkFwds.length > 0 ? pick(atkFwds)  : atkMid;
  const defDef  = defDefs.length > 0 ? pick(defDefs)  : defMid;
  const keeper  = gk ?? pick(defendingTeam);

  // Helper to get live stamina
  const st = (p: MatchPlayer) => liveStamina[p.id] ?? p.stamina;
  const gl = (p: MatchPlayer, links: Record<string, boolean>) => links[p.id] ?? false;

  // ── PHASE 1: Build-up (Midfield battle) ───────────────────────────────────
  const atkBuild = eff(atkMid, atkMid.stats.passing + atkMid.stats.dribbling, gl(atkMid, atkGreenLinks), st(atkMid));
  const defBuild = eff(defMid, defMid.stats.defending + defMid.stats.physical,gl(defMid, defGreenLinks), st(defMid));

  const builupWon = duel(atkBuild, defBuild);

  if (!builupWon) {
    events.push({
      type: 'breakthrough_failed',
      minute,
      player_id: defMid.id,
      player_name: defMid.name,
      team: defKey,
      details: `${atkMid.name} ${pick(BUILDUP_LOSE)}. ${defMid.name} wins the ball back.`
    });
    return;
  }

  // ── PHASE 2: Penetration (Attacker vs Defender) ───────────────────────────
  let atkPaceVal = atkFwd.stats.pace + atkFwd.stats.dribbling;
  let defStopVal = defDef.stats.pace + defDef.stats.defending;

  // Trait: Sniper gets minor pace boost in penetration
  if (atkFwd.traits.includes('Sniper'))   atkPaceVal += 5;
  // Trait: Wall blocks penetration better
  if (defDef.traits.includes('Wall'))     defStopVal += 8;
  // Trait: Paceman gains a significant penetration boost
  if (atkFwd.traits.includes('Paceman'))  atkPaceVal += 7;

  const atkPace = eff(atkFwd, atkPaceVal, gl(atkFwd, atkGreenLinks), st(atkFwd));
  const defStop = eff(defDef, defStopVal, gl(defDef, defGreenLinks),  st(defDef));

  // Cards / injuries: 5% chance on a failed or hard-fought penetration
  if (Math.random() < 0.05) {
    const r = Math.random();
    if (r < 0.55) {
      events.push({ type: 'yellow_card', minute, player_id: defDef.id, player_name: defDef.name, team: defKey, details: `ЖЁЛТАЯ! ${defDef.name} срубает ${atkFwd.name} на подходе к штрафной.` });
    } else if (r < 0.80) {
      events.push({ type: 'injury',      minute, player_id: atkFwd.id, player_name: atkFwd.name, team: atkKey, details: `ТРАВМА! ${atkFwd.name} получает повреждение в жёстком стыке с ${defDef.name}.` });
    } else {
      events.push({ type: 'red_card',    minute, player_id: defDef.id, player_name: defDef.name, team: defKey, details: `КРАСНАЯ! ${defDef.name} удалён за фол последней надежды на ${atkFwd.name}!` });
    }
    return;
  }

  const penetWon = duel(atkPace, defStop);

  if (!penetWon) {
    events.push({
      type: 'breakthrough_failed',
      minute,
      player_id: defDef.id,
      player_name: defDef.name,
      team: defKey,
      details: `${atkFwd.name} ${pick(PENET_LOSE)}. ${defDef.name} reads the run perfectly.`
    });
    return;
  }

  // ── PHASE 3: Finishing (Striker vs Goalkeeper) ────────────────────────────
  let shotVal = atkFwd.stats.shooting + atkFwd.stats.physical * 0.3;
  let saveVal = keeper.stats.defending + keeper.stats.physical;

  // Trait: Sniper gets a significant bonus to finishing
  if (atkFwd.traits.includes('Sniper'))    shotVal += 10;
  // Trait: Brick Wall keeper gets bonus saves
  if (keeper.traits.includes('Wall'))      saveVal += 8;
  if (keeper.traits.includes('Reflexes'))  saveVal += 6;

  const atkShot = eff(atkFwd,  shotVal, gl(atkFwd, atkGreenLinks),  st(atkFwd));
  const defSave = eff(keeper,  saveVal, gl(keeper, defGreenLinks),   st(keeper));

  const goalScored = duel(atkShot, defSave);

  if (goalScored) {
    score[atkKey]++;
    const penet = pick(PENET_WIN);
    events.push({
      type: 'goal',
      minute,
      player_id: atkFwd.id,
      player_name: atkFwd.name,
      team: atkKey,
      details: `⚽ ГОЛ! ${atkFwd.name} ${penet} and smashes the ball past ${keeper.name}! (${atkMid.name} → ${atkFwd.name})`
    });
  } else {
    // Decide: was it a save or a miss?
    const keeperHeroic = !duel(atkShot, defSave * 0.7); // second check — if keeper dominates, it's a save
    if (keeperHeroic) {
      events.push({
        type: 'save',
        minute,
        player_id: keeper.id,
        player_name: keeper.name,
        team: defKey,
        details: `🧤 СЭЙВ! ${keeper.name} ${pick(SAVE_MSGS)} ${atkFwd.name} can't believe it!`
      });
    } else {
      events.push({
        type: 'save',
        minute,
        player_id: atkFwd.id,
        player_name: atkFwd.name,
        team: atkKey,
        details: `💨 ${atkFwd.name} ${pick(MISS_MSGS)} after a great run by ${atkMid.name}.`
      });
    }
  }
}

// =============================================================================
// Main export: simulateMatch
// =============================================================================

/**
 * FitManager Match Engine v2.0
 *
 * @param homeTeam        - 11 home players with stats, stamina, traits
 * @param awayTeam        - 11 away players
 * @param homeGreenLinks  - Map of playerId → true if player has a green chemistry link
 * @param awayGreenLinks  - Map of playerId → true if player has a green chemistry link
 */
export function simulateMatch(
  homeTeam: MatchPlayer[],
  awayTeam: MatchPlayer[],
  homeGreenLinks: Record<string, boolean>,
  awayGreenLinks: Record<string, boolean>
): MatchResult {
  const events: MatchEvent[] = [];
  const score  = { home: 0, away: 0 };
  const staminaDrain: { home: Record<string, number>; away: Record<string, number> } = {
    home: {},
    away: {}
  };

  // ── 1. Stamina drain (Engine of each player during the 90 min) ─────────────
  drainStamina(homeTeam, 'home', staminaDrain);
  drainStamina(awayTeam, 'away', staminaDrain);

  // Live stamina = average of start stamina and post-match stamina
  // (players degrade during the game, not just at the end)
  const liveStaminaMap: Record<string, number> = {};
  for (const p of [...homeTeam, ...awayTeam]) {
    const teamKey = homeTeam.includes(p) ? 'home' : 'away';
    const endStamina = staminaDrain[teamKey][p.id] ?? p.stamina;
    // Midpoint represents average effective stamina across 90 minutes
    liveStaminaMap[p.id] = Math.round((p.stamina + endStamina) / 2);
  }

  // ── 2. Midfield Control → Possession → Number of Attacks ──────────────────
  const homeMid = midfieldScore(homeTeam, 'home', homeGreenLinks, liveStaminaMap);
  const awayMid = midfieldScore(awayTeam, 'away', awayGreenLinks, liveStaminaMap);
  const totalMid = homeMid + awayMid || 1;

  const homePoss = homeMid / totalMid; // 0.0 – 1.0
  const awayPoss = 1 - homePoss;

  // Attacks: 60% possession → 7–9 attacks; 40% → 4–6; base 5 each
  const homeAttacks = Math.round(3 + homePoss * 9 + Math.random() * 2);
  const awayAttacks = Math.round(3 + awayPoss * 9 + Math.random() * 2);

  // ── 3. Build chronological attack timeline (minute-stamped) ───────────────
  type AttackSlot = { team: 'home' | 'away'; minute: number };
  const timeline: AttackSlot[] = [];

  const spread = (count: number, team: 'home' | 'away') => {
    for (let i = 0; i < count; i++) {
      // Spread across 90 minutes with natural clustering
      const base = Math.floor((i / count) * 85) + 2;
      const jitter = Math.floor(Math.random() * 6) - 2;
      timeline.push({ team, minute: Math.min(90, Math.max(1, base + jitter)) });
    }
  };

  spread(homeAttacks, 'home');
  spread(awayAttacks, 'away');
  timeline.sort((a, b) => a.minute - b.minute);

  // Deduplicate minutes (avoid same minute events)
  const usedMinutes = new Set<number>();
  const uniqueTimeline = timeline.map(slot => {
    let m = slot.minute;
    while (usedMinutes.has(m)) m++;
    usedMinutes.add(m);
    return { ...slot, minute: Math.min(90, m) };
  });

  // ── 4. Process each attack in chronological order ─────────────────────────
  for (const slot of uniqueTimeline) {
    if (slot.team === 'home') {
      resolveAttack({
        attackingTeam: homeTeam,
        defendingTeam: awayTeam,
        atkKey: 'home',
        defKey: 'away',
        atkGreenLinks: homeGreenLinks,
        defGreenLinks: awayGreenLinks,
        liveStamina: liveStaminaMap,
        minute: slot.minute,
        events,
        score
      });
    } else {
      resolveAttack({
        attackingTeam: awayTeam,
        defendingTeam: homeTeam,
        atkKey: 'away',
        defKey: 'home',
        atkGreenLinks: awayGreenLinks,
        defGreenLinks: homeGreenLinks,
        liveStamina: liveStaminaMap,
        minute: slot.minute,
        events,
        score
      });
    }
  }

  // ── 5. Score cap: only extreme OVR disparity (20+) allows > 5 goals ───────
  const calcAvgOVR = (team: MatchPlayer[]) =>
    team.reduce((s, p) => s + (p.stats.pace + p.stats.shooting + p.stats.passing + p.stats.dribbling + p.stats.defending + p.stats.physical) / 6, 0) / (team.length || 1);

  const homeOVR = calcAvgOVR(homeTeam);
  const awayOVR = calcAvgOVR(awayTeam);
  const ovrDiff = Math.abs(homeOVR - awayOVR);

  // Soft cap: reduce score of the losing team if OVR gap < 20
  if (ovrDiff < 20) {
    const maxGoals = ovrDiff < 5 ? 4 : ovrDiff < 10 ? 5 : 6;
    score.home = Math.min(score.home, maxGoals);
    score.away = Math.min(score.away, maxGoals);
  }

  // ── 6. Sort events by minute for the journal ──────────────────────────────
  events.sort((a, b) => a.minute - b.minute);

  return { score, events, staminaDrain };
}
