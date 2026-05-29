import React from 'react';
import { Activity, Shield, Zap, Tag } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  ovr: number;
  stamina: number;
  lineup_status?: string;
  is_nft_coach?: boolean;
  traits?: string[];
}

interface PlayerCardProps {
  player: Player;
  onSell?: () => void;
}

export function PlayerCard({ player, onSell }: PlayerCardProps) {
  const isStarter = player.lineup_status === 'starting';
  
  // Determine stamina color based on Match Engine consequences
  let staminaColor = 'bg-neon-green';
  if (player.stamina < 20) {
    staminaColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'; // Critical
  } else if (player.stamina < 50) {
    staminaColor = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]'; // Warning
  } else {
    staminaColor = 'bg-neon-green shadow-[0_0_10px_rgba(57,255,20,0.5)]'; // Healthy
  }

  return (
    <div className={`relative bg-black/60 backdrop-blur-md border ${isStarter ? 'border-neon-cyan/50' : 'border-gray-800'} rounded-lg p-3 flex flex-col gap-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)] overflow-hidden group hover:border-neon-cyan transition-colors`}>
      
      {/* Position Badge & OVR */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isStarter ? 'text-neon-cyan' : 'text-gray-500'}`}>
            {player.position}
          </span>
          <span className="text-sm font-bold text-white truncate max-w-[120px]" title={player.name}>
            {player.name}
          </span>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 border border-gray-700 shadow-inner">
            <span className="text-sm font-orbitron font-black text-white">{player.ovr}</span>
          </div>
          <span className="text-[8px] text-gray-500 font-bold tracking-widest mt-1">OVR</span>
        </div>
      </div>

      {/* Stamina Bar */}
      <div className="flex flex-col gap-1 mt-auto">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
          <span className="flex items-center gap-1"><Activity size={10} /> Stamina</span>
          <span>{player.stamina}/100</span>
        </div>
        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
          <div 
            className={`h-full transition-all duration-500 ${staminaColor}`} 
            style={{ width: `${Math.max(0, Math.min(100, player.stamina))}%` }} 
          />
        </div>
      </div>

      {/* Decorators & Actions */}
      <div className="absolute top-0 right-0 flex items-start gap-1 p-1 z-10">
        {onSell && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSell();
            }}
            className="w-6 h-6 bg-red-900/60 hover:bg-red-600 border border-red-500/50 rounded flex items-center justify-center text-red-400 hover:text-white transition-colors"
            title="Sell Player"
          >
            <Tag size={12} />
          </button>
        )}
        {player.is_nft_coach && (
          <div className="w-6 h-6 bg-purple-900/60 border border-purple-500/50 rounded flex items-center justify-center text-purple-400">
            <Zap size={12} />
          </div>
        )}
      </div>
    </div>
  );
}
