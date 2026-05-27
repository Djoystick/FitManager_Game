export const FORMATIONS = {
  '4-4-2': { FWD: [9, 10], MID: [5, 6, 7, 8], DEF: [1, 2, 3, 4], GK: [0] },
  '4-3-3': { FWD: [8, 9, 10], MID: [5, 6, 7], DEF: [1, 2, 3, 4], GK: [0] },
  '3-5-2': { FWD: [9, 10], MID: [4, 5, 6, 7, 8], DEF: [1, 2, 3], GK: [0] }
};

export const FORMATION_LINKS = {
  '4-4-2': [ 
    [0,2], [0,3], // GK to CBs
    [1,2], [2,3], [3,4], // DEF line
    [1,5], [2,6], [3,7], [4,8], // DEF to MID
    [5,6], [6,7], [7,8], // MID line
    [5,9], [6,9], [7,10], [8,10], // MID to FWD
    [9,10] // FWD line
  ],
  '4-3-3': [ 
    [0,2], [0,3], 
    [1,2], [2,3], [3,4], 
    [1,5], [2,6], [3,6], [3,7], [4,7], 
    [5,6], [6,7], 
    [5,8], [6,9], [7,10], 
    [8,9], [9,10] 
  ],
  '3-5-2': [ 
    [0,1], [0,2], [0,3], 
    [1,2], [2,3], 
    [1,4], [1,5], [2,6], [3,7], [3,8], 
    [4,5], [5,6], [6,7], [7,8], 
    [4,9], [5,9], [6,9], [6,10], [7,10], [8,10], 
    [9,10] 
  ]
};

export const isCompatible = (natural: string, idealLine: string) => {
  if (!idealLine) return true;
  if (natural === idealLine) return true;
  if (['LWF', 'RWF', 'ST', 'CF'].includes(natural) && idealLine === 'FWD') return true;
  if (['CAM', 'CDM', 'CM', 'RM', 'LM'].includes(natural) && idealLine === 'MID') return true;
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(natural) && idealLine === 'DEF') return true;
  return false;
};

export const getIdealLineForSlot = (slotIndex: number, formation: string) => {
  const layout = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2'];
  if (layout.FWD.includes(slotIndex)) return 'FWD';
  if (layout.MID.includes(slotIndex)) return 'MID';
  if (layout.DEF.includes(slotIndex)) return 'DEF';
  if (layout.GK.includes(slotIndex)) return 'GK';
  return ''; // For Bench slots
};

export interface PlayerRef {
  id: string;
  position: string;
  traits?: string[];
}

export interface ChemistryRecord {
  matches_together: number;
  sweat_points: number;
}

export function calculateLinkStrength(
  player1: PlayerRef | undefined,
  idealPos1: string,
  player2: PlayerRef | undefined,
  idealPos2: string,
  chemistryRecord?: ChemistryRecord
): 'red' | 'yellow' | 'green' | 'none' {
  if (!player1 || !player2) return 'none';
  
  let score = (chemistryRecord?.matches_together || 0) + ((chemistryRecord?.sweat_points || 0) * 5);
  
  const traits1 = player1.traits || [];
  const traits2 = player2.traits || [];
  
  let hasSynergy = false;
  let hasConflict = false;
  
  const synergyPairs = [
    ['Playmaker', 'Poacher'],
    ['Engine', 'Speedster'],
    ['Anchor', 'Wall']
  ];
  
  for (const [tA, tB] of synergyPairs) {
    if ((traits1.includes(tA) && traits2.includes(tB)) || 
        (traits1.includes(tB) && traits2.includes(tA))) {
      hasSynergy = true;
      break;
    }
  }
  
  if (traits1.includes('Leader') && traits2.includes('Leader')) {
    hasConflict = true;
  }
  
  if (hasSynergy) {
    score += 30;
  } else {
    score = Math.min(score, 69);
  }
  
  if (hasConflict) {
    score -= 20;
  }
  
  const isOOP1 = !isCompatible(player1.position, idealPos1);
  const isOOP2 = !isCompatible(player2.position, idealPos2);
  
  if (isOOP1 || isOOP2) {
    score *= 0.5;
  }
  
  if (score >= 70) return 'green';
  if (score >= 30) return 'yellow';
  return 'red';
}

export function getSlotCoords(slotIndex: number, formation: string): { x: number, y: number } {
  const layout = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2'];
  
  const getY = (line: string) => {
    switch (line) {
      case 'FWD': return 10;
      case 'MID': return 36.67;
      case 'DEF': return 63.33;
      case 'GK': return 90;
      default: return 0;
    }
  };

  let line = '';
  let lineArr: number[] = [];
  if (layout.FWD.includes(slotIndex)) { line = 'FWD'; lineArr = layout.FWD; }
  else if (layout.MID.includes(slotIndex)) { line = 'MID'; lineArr = layout.MID; }
  else if (layout.DEF.includes(slotIndex)) { line = 'DEF'; lineArr = layout.DEF; }
  else if (layout.GK.includes(slotIndex)) { line = 'GK'; lineArr = layout.GK; }

  if (!line) return { x: 0, y: 0 };

  const n = lineArr.length;
  const idx = lineArr.indexOf(slotIndex);
  const x = (idx + 0.5) * (100 / n);
  const y = getY(line);

  return { x, y };
}
