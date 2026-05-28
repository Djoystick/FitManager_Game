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

  // Helper to calculate Average OVR
  const calcOVR = (players: MatchPlayer[]) => {
    if (players.length === 0) return 0;
    return players.reduce((sum, p) => {
      return sum + (p.stats.pace + p.stats.shooting + p.stats.passing + p.stats.dribbling + p.stats.defending + p.stats.physical) / 6;
    }, 0) / players.length;
  };

  const homeOVR = calcOVR(homeTeam);
  const awayOVR = calcOVR(awayTeam);
  const diff = homeOVR - awayOVR;

  // 2. Realistic Volatile Score Calculation
  let homeBase = Math.random() * 2; // 0 to 2
  let awayBase = Math.random() * 2; // 0 to 2

  if (diff > 5) {
    homeBase += (diff / 10) * (Math.random() * 1.5 + 0.5);
    awayBase -= (diff / 15) * Math.random();
  } else if (diff < -5) {
    awayBase += (Math.abs(diff) / 10) * (Math.random() * 1.5 + 0.5);
    homeBase -= (Math.abs(diff) / 15) * Math.random();
  }

  const targetHomeScore = Math.max(0, Math.round(homeBase));
  const targetAwayScore = Math.max(0, Math.round(awayBase));

  let homeAttacks = Math.max(4, targetHomeScore + Math.floor(Math.random() * 3));
  let awayAttacks = Math.max(4, targetAwayScore + Math.floor(Math.random() * 3));

  const totalAttacks = homeAttacks + awayAttacks;
  const minuteInterval = 90 / (totalAttacks + 1);
  let currentMinute = 0;

  let homeGoalsScored = 0;
  let awayGoalsScored = 0;

  const isAtk = (pos: string) => ['FWD', 'ST', 'CF', 'LWF', 'RWF', 'CAM', 'RM', 'LM'].includes(pos || '');
  const isDef = (pos: string) => ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(pos || '');

  const processAttack = (
    attackingTeam: MatchPlayer[], 
    defendingTeam: MatchPlayer[], 
    atkKey: 'home' | 'away', 
    defKey: 'home' | 'away',
    isGoal: boolean
  ) => {
    currentMinute = Math.min(90, Math.floor(currentMinute + minuteInterval + (Math.random() * 4 - 2)));
    
    const attackers = attackingTeam.filter(p => isAtk(p.position));
    const defenders = defendingTeam.filter(p => isDef(p.position));
    const gk = defendingTeam.find(p => p.position === 'GK');

    const attacker = attackers.length > 0 ? attackers[Math.floor(Math.random() * attackers.length)] : attackingTeam[Math.floor(Math.random() * attackingTeam.length)];
    const defender = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : defendingTeam[Math.floor(Math.random() * defendingTeam.length)];
    const goalie = gk || defendingTeam[0];

    // Cards / Injuries Logic (5% chance of foul on non-goal attacks)
    if (!isGoal && Math.random() < 0.05) {
       const eventTypeRandom = Math.random();
       if (eventTypeRandom < 0.6) {
           events.push({ type: 'yellow_card', minute: currentMinute, player_id: defender.id, player_name: defender.name, team: defKey, details: `ЖЕЛТАЯ КАРТОЧКА! ${defender.name} грубо фолит.` });
       } else if (eventTypeRandom < 0.8) {
           events.push({ type: 'injury', minute: currentMinute, player_id: attacker.id, player_name: attacker.name, team: atkKey, details: `ТРАВМА! ${attacker.name} получает повреждение.` });
       } else {
           events.push({ type: 'red_card', minute: currentMinute, player_id: defender.id, player_name: defender.name, team: defKey, details: `КРАСНАЯ КАРТОЧКА! ${defender.name} удален!` });
       }
       return;
    }

    if (isGoal) {
      score[atkKey]++;
      events.push({
        type: 'goal',
        minute: currentMinute,
        player_id: attacker.id,
        player_name: attacker.name,
        team: atkKey,
        details: `ГОЛ! ${attacker.name} прошивает ворота ${goalie?.name || 'соперника'}.`
      });
    } else {
      if (Math.random() > 0.5) {
        events.push({
          type: 'save',
          minute: currentMinute,
          player_id: goalie?.id || defender.id,
          player_name: goalie?.name || defender.name,
          team: defKey,
          details: `СЭЙВ! Вратарь тащит удар от ${attacker.name}.`
        });
      } else {
        events.push({
          type: 'breakthrough_failed',
          minute: currentMinute,
          player_id: defender.id,
          player_name: defender.name,
          team: defKey,
          details: `ОТБОР! ${defender.name} останавливает атаку ${attacker.name}.`
        });
      }
    }
  };

  const attackSequence = [];
  for (let i = 0; i < homeAttacks; i++) attackSequence.push({ team: 'home', isGoal: i < targetHomeScore });
  for (let i = 0; i < awayAttacks; i++) attackSequence.push({ team: 'away', isGoal: i < targetAwayScore });
  
  // Shuffle attacks
  attackSequence.sort(() => Math.random() - 0.5);

  attackSequence.forEach(atk => {
    if (atk.team === 'home') {
      processAttack(homeTeam, awayTeam, 'home', 'away', atk.isGoal);
    } else {
      processAttack(awayTeam, homeTeam, 'away', 'home', atk.isGoal);
    }
  });

  return {
    score,
    events,
    staminaDrain
  };
}
