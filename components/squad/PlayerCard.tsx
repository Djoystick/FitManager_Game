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
  
  // OVR-based rarity styling
  const getRarityStyle = (ovr: number) => {
    if (ovr >= 90) return {
      border: 'border-fuchsia-500/50',
      glow: 'shadow-[0_0_20px_rgba(217,70,239,0.3)]',
      bg: 'from-fuchsia-500/10 to-purple-500/5',
      ovrText: 'text-fuchsia-300',
      ovrGlow: '0 0 15px rgba(217,70,239,0.6)',
      badge: 'bg-fuchsia-500/20 text-fuchsia-300',
    };
    if (ovr >= 80) return {
      border: 'border-amber-500/50',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
      bg: 'from-amber-500/10 to-yellow-500/5',
      ovrText: 'text-amber-300',
      ovrGlow: '0 0 15px rgba(245,158,11,0.5)',
      badge: 'bg-amber-500/20 text-amber-300',
    };
    if (ovr >= 65) return {
      border: 'border-cyan-400/40',
      glow: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]',
      bg: 'from-cyan-500/8 to-blue-500/5',
      ovrText: 'text-cyan-300',
      ovrGlow: '0 0 12px rgba(34,211,238,0.5)',
      badge: 'bg-cyan-500/15 text-cyan-300',
    };
    return {
      border: 'border-white/10',
      glow: '',
      bg: 'from-white/5 to-white/2',
      ovrText: 'text-gray-400',
      ovrGlow: 'none',
      badge: 'bg-white/10 text-gray-400',
    };
  };

  const rarity = getRarityStyle(player.ovr);

  // Stamina bar color
  const getStaminaColor = (stamina: number) => {
    if (stamina >= 70) return { bar: 'bg-emerald-400', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.6)]', text: 'text-emerald-400' };
    if (stamina >= 40) return { bar: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.5)]', text: 'text-amber-400' };
    return { bar: 'bg-red-500', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]', text: 'text-red-400' };
  };

  const staminaStyle = getStaminaColor(player.stamina);

  return (
    <div 
      className={`relative rounded-2xl border backdrop-blur-md overflow-hidden transition-all duration-300 
                  active:scale-[0.97] hover:scale-[1.02] cursor-pointer group
                  ${rarity.border} ${rarity.glow} ${isStarter ? 'ring-1 ring-cyan-400/30' : ''}
                  bg-gradient-to-br ${rarity.bg}`}
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
      }}
    >
      {/* Glass highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      {/* Top section: Position + OVR */}
      <div className="flex justify-between items-start p-2.5 pb-1">
        {/* Position badge */}
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${rarity.badge}`}>
          {player.position}
        </span>
        
        {/* OVR — massive and glowing */}
        <div className="flex flex-col items-center">
          <span 
            className={`text-xl font-black font-orbitron leading-none ${rarity.ovrText}`}
            style={{ textShadow: rarity.ovrGlow }}
          >
            {player.ovr}
          </span>
          <span className="text-[6px] text-gray-600 uppercase tracking-widest font-bold">OVR</span>
        </div>
      </div>

      {/* Avatar section */}
      <div className="flex justify-center px-2 py-1">
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-black/30 flex items-center justify-center">
          <img 
            src={`https://api.dicebear.com/9.x/micah/svg?seed=${player.id}&backgroundColor=transparent`}
            alt="Avatar"
            className="w-full h-full object-cover mix-blend-screen opacity-90"
          />
        </div>
      </div>

      {/* Name */}
      <div className="px-2.5 text-center">
        <div className="text-[10px] font-bold text-white truncate" title={player.name}>
          {player.name}
        </div>
      </div>

      {/* Stamina bar */}
      <div className="px-2.5 pb-2 pt-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[7px] text-gray-500 uppercase tracking-wider font-bold">STA</span>
          <span className={`text-[8px] font-black font-orbitron ${staminaStyle.text}`}>
            {player.stamina}
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${staminaStyle.bar} ${staminaStyle.glow}`}
            style={{ width: `${Math.max(0, Math.min(100, player.stamina))}%` }}
          />
        </div>
      </div>

      {/* Decorators & Actions */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
        {onSell && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSell();
            }}
            className="w-5 h-5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-md 
                       flex items-center justify-center text-red-400 hover:text-white 
                       transition-all duration-200 active:scale-90 opacity-0 group-hover:opacity-100"
            title="Sell Player"
          >
            <Tag size={9} />
          </button>
        )}
        {player.is_nft_coach && (
          <div className="w-5 h-5 bg-purple-500/20 border border-purple-500/30 rounded-md 
                         flex items-center justify-center text-purple-400">
            <Zap size={9} />
          </div>
        )}
      </div>

      {/* Starter indicator */}
      {isStarter && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-cyan-500" />
      )}
    </div>
  );
}
