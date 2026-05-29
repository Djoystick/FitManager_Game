'use client';

import React, { useState } from 'react';
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

      {/* Trait Nodes Overlay */}
      {players.filter(p => p.lineup_status === 'starting').map(p => {
        const slot = parseInt(p.lineup_slot || '-1', 10);
        if (slot < 0) return null;
        
        const coords = getSlotCoords(slot, formation);
        const hasTraits = (p as any).traits && (p as any).traits.length > 0;
        
        if (!hasTraits) return null;

        return (
          <div 
            key={p.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex gap-1"
            style={{ 
              left: `${coords.x}%`, 
              top: `calc(${coords.y}% - 45px)` // Position slightly above the player card
            }}
          >
            {(p as any).traits.map((trait: string, idx: number) => (
              <div 
                key={idx}
                className="bg-black/80 border border-neon-cyan/50 text-neon-cyan text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(0,255,255,0.6)] backdrop-blur-sm whitespace-nowrap"
              >
                {trait}
              </div>
            ))}
          </div>
        );
      })}

      {/* Info Button */}
      <div className="absolute right-4 bottom-24 pointer-events-auto">
        <button
          onClick={() => setShowLegend(true)}
          className="w-10 h-10 rounded-full bg-black/80 border border-neon-cyan/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.2)] text-neon-cyan font-bold hover:bg-neon-cyan/20 transition-colors"
        >
          ?
        </button>
      </div>

      {/* Legend Modal */}
      {showLegend && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowLegend(false)}
        >
          <div 
            className="w-full max-w-sm bg-black/90 border border-neon-cyan/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.3)] relative"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowLegend(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-white font-bold text-base mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse"></span>
              Синергия (Match Engine)
            </h3>
            
            <div className="space-y-4 text-sm text-gray-300">
              <p className="border-b border-gray-800 pb-3">
                <span className="text-neon-cyan font-bold block mb-1">Как это работает:</span>
                Связки стилей дают <strong className="text-neon-green">+10%</strong> к статам в дуэлях. Конфликты (два Лидера) забирают <strong className="text-red-500">-15%</strong>.
              </p>

              <div>
                <span className="text-gray-400 block mb-2">Комбинации трейтов:</span>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Playmaker + Poacher</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Engine + Speedster</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Anchor + Wall</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-red-900/20 p-2 rounded mt-2 border border-red-900/50">
                    <span>Leader + Leader</span>
                    <span className="text-red-500 font-bold">-15%</span>
                  </li>
                </ul>
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-800">
                <span className="text-gray-400 block mb-2">Связи на поле (Линии):</span>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-[#39ff14] shadow-[0_0_5px_#39ff14]"></div>
                  <span>Отличная (Матчи + Стиль)</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-yellow-500"></div>
                  <span>Базовая (Позиции)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 border-t-2 border-dashed border-red-500"></div>
                  <span>Конфликт</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
