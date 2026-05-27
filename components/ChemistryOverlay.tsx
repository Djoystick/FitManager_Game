'use client';

import React from 'react';
import { 
  FORMATION_LINKS, 
  getSlotCoords, 
  calculateLinkStrength, 
  getIdealLineForSlot,
  ChemistryRecord 
} from '@/app/utils/chemistry';

interface Player {
  id: string;
  position: string;
  lineup_slot?: string;
  lineup_status: string;
}

interface Props {
  formation: string;
  players: Player[];
  chemistryData?: Record<string, ChemistryRecord>; // key: `${id1}_${id2}` or similar
}

export function ChemistryOverlay({ formation, players, chemistryData }: Props) {
  const links = FORMATION_LINKS[formation as keyof typeof FORMATION_LINKS] || [];

  const getPlayerInSlot = (slotIndex: number) => {
    return players.find(p => parseInt(p.lineup_slot || '-1', 10) === slotIndex);
  };

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-0" 
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {links.map(([slot1, slot2], idx) => {
        const p1 = getPlayerInSlot(slot1);
        const p2 = getPlayerInSlot(slot2);
        
        if (!p1 || !p2) return null; // Only draw if both players are present

        const idealPos1 = getIdealLineForSlot(slot1, formation);
        const idealPos2 = getIdealLineForSlot(slot2, formation);

        // Get mock data for now
        const record = chemistryData ? chemistryData[`${p1.id}_${p2.id}`] : { matches_together: 50, sweat_points: 0 };
        
        const strength = calculateLinkStrength(p1, idealPos1, p2, idealPos2, record);
        if (strength === 'none') return null;

        const coords1 = getSlotCoords(slot1, formation);
        const coords2 = getSlotCoords(slot2, formation);

        let strokeColor = '';
        let strokeWidth = 2;
        let dasharray = '';
        let filter = '';

        if (strength === 'red') {
          strokeColor = '#ef4444'; // Tailwind red-500
          strokeWidth = 1.5;
          dasharray = '4 4';
        } else if (strength === 'yellow') {
          strokeColor = '#eab308'; // Tailwind yellow-500
          strokeWidth = 2.5;
        } else if (strength === 'green') {
          strokeColor = '#39ff14'; // Neon Green
          strokeWidth = 3;
          filter = 'url(#neon-glow)';
        }

        return (
          <line
            key={`${slot1}-${slot2}-${idx}`}
            x1={`${coords1.x}%`}
            y1={`${coords1.y}%`}
            x2={`${coords2.x}%`}
            y2={`${coords2.y}%`}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dasharray}
            filter={filter}
            className="transition-all duration-500"
          />
        );
      })}
    </svg>
  );
}
