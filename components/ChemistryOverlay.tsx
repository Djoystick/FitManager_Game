'use client';

import React, { useState } from 'react';
import { 
  FORMATION_LINKS, 
  getSlotCoords, 
  calculateLinkStrength, 
  getIdealLineForSlot,
  ChemistryRecord 
} from '@/app/utils/chemistry';

const TRAIT_COLORS: Record<string, { bg: string, border: string, text: string, short: string }> = {
  'Sniper': { bg: 'bg-teal-900/80', border: 'border-teal-500', text: 'text-teal-400', short: 'SN' },
  'Playmaker': { bg: 'bg-blue-900/80', border: 'border-blue-500', text: 'text-blue-400', short: 'PM' },
  'Wall': { bg: 'bg-purple-900/80', border: 'border-purple-500', text: 'text-purple-400', short: 'WL' },
  'Speedster': { bg: 'bg-orange-900/80', border: 'border-orange-500', text: 'text-orange-400', short: 'SP' },
  'Anchor': { bg: 'bg-indigo-900/80', border: 'border-indigo-500', text: 'text-indigo-400', short: 'AN' },
  'Poacher': { bg: 'bg-pink-900/80', border: 'border-pink-500', text: 'text-pink-400', short: 'PO' },
  'Engine': { bg: 'bg-yellow-900/80', border: 'border-yellow-500', text: 'text-yellow-400', short: 'EN' },
  'Leader': { bg: 'bg-red-900/80', border: 'border-red-500', text: 'text-red-400', short: 'LD' },
};

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
  const [showLegend, setShowLegend] = useState(false);
  const links = FORMATION_LINKS[formation as keyof typeof FORMATION_LINKS] || [];

  const getPlayerInSlot = (slotIndex: number) => {
    return players.find(p => parseInt(p.lineup_slot || '-1', 10) === slotIndex);
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-20">
      
      {/* SVG for lines */}
      <svg 
        className="absolute inset-0 w-full h-full overflow-visible" 
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
          
          if (!p1 || !p2) return null;

          const idealPos1 = getIdealLineForSlot(slot1, formation);
          const idealPos2 = getIdealLineForSlot(slot2, formation);
          const record = chemistryData ? chemistryData[`${p1.id}_${p2.id}`] : { matches_together: 50, sweat_points: 0 };
          const strength = calculateLinkStrength(p1 as any, idealPos1, p2 as any, idealPos2, record);
          
          if (strength === 'none') return null;

          const coords1 = getSlotCoords(slot1, formation);
          const coords2 = getSlotCoords(slot2, formation);

          let strokeColor = '';
          let strokeWidth = 2;
          let dasharray = '';
          let filter = '';

          if (strength === 'red') {
            strokeColor = '#ef4444'; // red-500
            strokeWidth = 1.5;
            dasharray = '4 4';
          } else if (strength === 'yellow') {
            strokeColor = '#eab308'; // yellow-500
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

      {/* Compact Trait Nodes Overlay */}
      {players.filter(p => p.lineup_status === 'starting').map(p => {
        const slot = parseInt(p.lineup_slot || '-1', 10);
        if (slot < 0) return null;
        
        const coords = getSlotCoords(slot, formation);
        const hasTraits = (p as any).traits && (p as any).traits.length > 0;
        
        if (!hasTraits) return null;

        return (
          <div 
            key={p.id}
            className="absolute flex flex-col gap-0.5 z-30"
            style={{ 
              left: `calc(${coords.x}% + 18px)`, 
              top: `calc(${coords.y}% - 22px)` 
            }}
          >
            {(p as any).traits.map((trait: string, idx: number) => {
              const style = TRAIT_COLORS[trait] || { bg: 'bg-gray-900/80', border: 'border-gray-500', text: 'text-gray-400', short: trait.substring(0, 2).toUpperCase() };
              return (
                <div 
                  key={idx}
                  title={trait}
                  className={`w-5 h-5 flex items-center justify-center rounded-full border ${style.bg} ${style.border} ${style.text} text-[8px] font-black shadow-[0_0_8px_rgba(0,0,0,0.8)] backdrop-blur-sm`}
                >
                  {style.short}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
