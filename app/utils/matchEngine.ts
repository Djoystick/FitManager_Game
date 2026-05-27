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

/**
 * Симулятор матча на основе Микро-Дуэлей
 * @param homeTeam Массив игроков домашней команды (11 человек)
 * @param awayTeam Массив игроков гостевой команды (11 человек)
 * @param homeGreenLinks Маппинг playerId -> boolean (есть ли зеленая связь >= 70 у игрока)
 * @param awayGreenLinks Маппинг playerId -> boolean
 */
export function simulateMatch(
  homeTeam: MatchPlayer[],
  awayTeam: MatchPlayer[],
  homeGreenLinks: Record<string, boolean>,
  awayGreenLinks: Record<string, boolean>
): MatchResult {
  const events: MatchEvent[] = [];
  const score = { home: 0, away: 0 };
  
  const staminaDrain: { home: Record<string, number>; away: Record<string, number> } = { home: {}, away: {} };

  // 1. Calculate Stamina Drain (15-25 points, Engine trait reduces by 5)
  const calculateDrain = (players: MatchPlayer[], teamKey: 'home' | 'away') => {
    for (const p of players) {
      let drain = Math.floor(Math.random() * 11) + 15; // 15 to 25
      if (p.traits.includes('Engine')) {
        drain = Math.max(5, drain - 5);
      }
      const newStamina = Math.max(0, p.stamina - drain);
      staminaDrain[teamKey][p.id] = newStamina;
    }
  };

  calculateDrain(homeTeam, 'home');
  calculateDrain(awayTeam, 'away');

  // Helper to get effective stat value considering modifiers
  const getStat = (p: MatchPlayer, teamKey: 'home' | 'away', statValue: number) => {
    let multiplier = 1.0;
    // Debuff for low stamina
    if (p.stamina < 30) {
      multiplier *= 0.5;
    }
    // Buff for Chemistry (Green Link)
    const hasGreenLink = teamKey === 'home' ? homeGreenLinks[p.id] : awayGreenLinks[p.id];
    if (hasGreenLink) {
      multiplier *= 1.1;
    }
    return statValue * multiplier;
  };

  // 2. Midfield Control (PAS + DRI + PHY)
  const isMid = (pos: string) => ['MID', 'CAM', 'CDM', 'CM', 'RM', 'LM'].includes(pos || '');
  const isAtk = (pos: string) => ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM'].includes(pos || '');
  const isDef = (pos: string) => ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos || '');
  
  const calcMidScore = (players: MatchPlayer[], teamKey: 'home' | 'away') => {
    const mids = players.filter(p => isMid(p.position));
    if (mids.length === 0) return 100; // Fallback if no midfielders
    return mids.reduce((sum, p) => {
      const pas = getStat(p, teamKey, p.stats.passing);
      const dri = getStat(p, teamKey, p.stats.dribbling);
      const phy = getStat(p, teamKey, p.stats.physical);
      return sum + pas + dri + phy;
    }, 0);
  };

  const homeMid = calcMidScore(homeTeam, 'home');
  const awayMid = calcMidScore(awayTeam, 'away');
  
  const totalMid = homeMid + awayMid;
  const homeMidRatio = totalMid > 0 ? homeMid / totalMid : 0.5;
  const awayMidRatio = 1 - homeMidRatio;

  // Base attacks 4, bonus up to 6 based on Midfield dominance (Total attacks = 4 to 10 per team)
  const homeAttacks = 4 + Math.round(homeMidRatio * 6);
  const awayAttacks = 4 + Math.round(awayMidRatio * 6);

  // 3. Process Attacks
  let currentMinute = 0;
  const totalAttacks = homeAttacks + awayAttacks;
  const minuteInterval = 90 / (totalAttacks + 1);

  const processAttack = (
    attackingTeam: MatchPlayer[], 
    defendingTeam: MatchPlayer[], 
    atkKey: 'home' | 'away', 
    defKey: 'home' | 'away'
  ) => {
    currentMinute = Math.min(90, Math.floor(currentMinute + minuteInterval + (Math.random() * 4 - 2)));
    
    const attackers = attackingTeam.filter(p => isAtk(p.position));
    const defenders = defendingTeam.filter(p => isDef(p.position));
    const gk = defendingTeam.find(p => p.position === 'GK');

    // Fallbacks if team lacks proper positions
    const attacker = attackers.length > 0 ? attackers[Math.floor(Math.random() * attackers.length)] : attackingTeam[Math.floor(Math.random() * attackingTeam.length)];
    const defender = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : defendingTeam[Math.floor(Math.random() * defendingTeam.length)];
    const goalie = gk || defendingTeam[0];

    // Mico-Duel 1: Breakthrough Phase (Attacker PAC+DRI vs Defender PAC+DEF) + Dice Roll
    const atkBreakthrough = getStat(attacker, atkKey, attacker.stats.pace + attacker.stats.dribbling) + (Math.random() * 20);
    const defBreakthrough = getStat(defender, defKey, defender.stats.pace + defender.stats.defending) + (Math.random() * 20);

    // Cards / Injuries Logic (8% chance of hard foul)
    const foulChance = Math.random();
    if (foulChance < 0.08) {
       const eventTypeRandom = Math.random();
       if (eventTypeRandom < 0.6) {
           events.push({
             type: 'yellow_card',
             minute: currentMinute,
             player_id: defender.id,
             player_name: defender.name,
             team: defKey,
             details: `ЖЕЛТАЯ КАРТОЧКА! ${defender.name} грубо фолит на ${attacker.name}.`
           });
       } else if (eventTypeRandom < 0.8) {
           events.push({
             type: 'injury',
             minute: currentMinute,
             player_id: attacker.id,
             player_name: attacker.name,
             team: atkKey,
             details: `ТРАВМА! ${attacker.name} получает повреждение в стыке с ${defender.name}.`
           });
       } else {
           events.push({
             type: 'red_card',
             minute: currentMinute,
             player_id: defender.id,
             player_name: defender.name,
             team: defKey,
             details: `КРАСНАЯ КАРТОЧКА! ${defender.name} удален за жесткий подкат под ${attacker.name}!`
           });
       }
       return; // Attack stopped by foul
    }

    if (atkBreakthrough > defBreakthrough) {
      // Micro-Duel 2: Shooting Phase (Attacker SHO+PHY vs Goalkeeper DEF+PHY) + Dice Roll
      const atkShot = getStat(attacker, atkKey, attacker.stats.shooting + attacker.stats.physical) + (Math.random() * 20);
      const defSave = getStat(goalie, defKey, goalie.stats.defending + goalie.stats.physical) + (Math.random() * 20);

      if (atkShot > defSave) {
        score[atkKey]++;
        events.push({
          type: 'goal',
          minute: currentMinute,
          player_id: attacker.id,
          player_name: attacker.name,
          team: atkKey,
          details: `ГОЛ! ${attacker.name} прорвался сквозь ${defender.name} и мощно пробил мимо ${goalie.name}.`
        });
      } else {
        events.push({
          type: 'save',
          minute: currentMinute,
          player_id: goalie.id,
          player_name: goalie.name,
          team: defKey,
          details: `СЭЙВ! ${goalie.name} чудом тащит удар от ${attacker.name} после прорыва.`
        });
      }
    } else {
      events.push({
        type: 'breakthrough_failed',
        minute: currentMinute,
        player_id: defender.id,
        player_name: defender.name,
        team: defKey,
        details: `ОТБОР! ${defender.name} чисто останавливает прорыв ${attacker.name}.`
      });
    }
  };

  // Mix attacks randomly across the 90 minutes
  const attacks = [];
  for (let i = 0; i < homeAttacks; i++) attacks.push('home');
  for (let i = 0; i < awayAttacks; i++) attacks.push('away');
  attacks.sort(() => Math.random() - 0.5);

  attacks.forEach(teamAtk => {
    if (teamAtk === 'home') {
      processAttack(homeTeam, awayTeam, 'home', 'away');
    } else {
      processAttack(awayTeam, homeTeam, 'away', 'home');
    }
  });

  return {
    score,
    events,
    staminaDrain
  };
}
