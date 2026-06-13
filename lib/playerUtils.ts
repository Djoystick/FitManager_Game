export interface PlayerStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  sta: number;
  agi: number;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  age: number;
  ovr: number;
  potential_limit: number;
  position: string;
  stats: PlayerStats;
  stamina: number;
  traits?: string[];
  lineup_status: string;
  is_nft_coach: boolean;
  morale: number;
}

const FIRST_NAMES = [
  'Lamine', 'Endrick', 'Jude', 'Pedri', 'Gavi', 'Kobbie',
  'Alejandro', 'Jamal', 'Florian', 'Arda', 'Mathys', 'Evan', 'Xavi',
];
const LAST_NAMES = [
  'Yamal', 'Bellingham', 'Mainoo', 'Garnacho', 'Musiala', 'Wirtz',
  'Guler', 'Tel', 'Ferguson', 'Simons', 'Paz', 'Zaïre-Emery',
];
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// Available perks for the perk drop system
const AVAILABLE_PERKS = [
  'pace_demon', 'iron_wall', 'playmaker', 'clinical', 'workhorse',
  'aerial_threat', 'long_shot', 'captain', 'sniper', 'marathon_man',
];

export async function generateRandomPlayer(
  teamId: string,
  academyLevel: number = 1,
  scoutLevel: number   = 1,
  academyPerks: any[]  = []
): Promise<Omit<Player, 'id'> & { perk_granted: boolean }> {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName  = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const position  = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const age       = Math.floor(Math.random() * 4) + 16; // 16–19

  // Apply academy perks
  let extraBonus = 0;
  let extraPerkChance = 0;
  
  if (Array.isArray(academyPerks)) {
    for (const perk of academyPerks) {
      if (perk.type === 'generic_boost') {
        extraBonus += 1;
        extraPerkChance += perk.bonus_chance || 0;
      } else if (perk.type === `scout_${position.toLowerCase()}_boost`) {
        extraBonus += 2;
        extraPerkChance += (perk.bonus_chance || 0) * 1.5;
      }
    }
  }

  const FC_MARKET_OVR_CAP = 62;
  const academyBonus = Math.min((academyLevel - 1) * 2 + extraBonus, 18);
  const ovrFloor     = Math.min(48 + academyBonus, 58); // floor: 48 (lvl1) → 58 (lvl6+)
  const rawOvr       = Math.floor(Math.random() * 15) + ovrFloor; // floor+0 to floor+14
  const ovr          = Math.min(rawOvr, FC_MARKET_OVR_CAP);       // HARD CAP at 62
  const potentialLimit = Math.min(99, Math.floor(Math.random() * (99 - (ovr + 8) + 1)) + (ovr + 8));

  // Generate stats clustered around OVR (Phase 8 W2E keys)
  const genStat = () => Math.min(99, Math.max(1, Math.round(ovr + (Math.random() * 20 - 10))));

  const stats: PlayerStats = {
    pac: genStat(), sho: genStat(), pas: genStat(), dri: genStat(),
    def: genStat(), phy: genStat(), sta: genStat(), agi: genStat(),
  };

  // Position-based stat adjustments
  if (position === 'FWD') {
    stats.sho = Math.min(99, stats.sho + 10);
    stats.pac = Math.min(99, stats.pac + 5);
  } else if (position === 'MID') {
    stats.pas = Math.min(99, stats.pas + 10);
    stats.dri = Math.min(99, stats.dri + 5);
  } else if (position === 'DEF') {
    stats.def = Math.min(99, stats.def + 15);
    stats.phy = Math.min(99, stats.phy + 5);
  } else if (position === 'GK') {
    stats.def = Math.min(99, stats.def + 20);
    stats.phy = Math.min(99, stats.phy + 5);
  }

  // Scout perk drop: 10% base + 5% per scout level + retired player bonuses
  const perkChance = Math.min(0.10 + (scoutLevel * 0.05) + extraPerkChance, 0.75); // max 75%
  const perk_granted = Math.random() < perkChance;
  const traits: string[] = perk_granted
    ? [AVAILABLE_PERKS[Math.floor(Math.random() * AVAILABLE_PERKS.length)]]
    : [];

  return {
    team_id:       teamId,
    name:          `${firstName} ${lastName}`,
    age,
    ovr,
    potential_limit: potentialLimit,
    position,
    stats,
    stamina:       100,
    lineup_status: 'bench',
    is_nft_coach:  false, // Kept for legacy, now we also use is_retired in DB
    traits,
    perk_granted,
    morale:        70,
  };
}
