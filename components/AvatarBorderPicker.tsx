'use client';

import { useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';

interface AvatarBorderPickerProps {
  currentBorder: string;
  fcBalance: number;
  unlockedBorders: string[];
  onSelect: (borderId: string) => void;
}

const BORDERS = [
  {
    id: 'default',
    label: 'Standard',
    cost: 0,
    description: 'Classic border',
    className: 'border-gray-600/40',
    preview: 'border-2 border-gray-600/40 rounded-full',
  },
  {
    id: 'neon-cyan',
    label: 'Neon Cyan',
    cost: 500,
    description: 'Pulsing cyan glow',
    className: 'border-neon-cyan',
    preview: 'border-2 border-cyan-400 rounded-full border-neon-cyan',
  },
  {
    id: 'gold-glow',
    label: 'Gold Glow',
    cost: 1500,
    description: 'Premium gold shimmer',
    className: 'border-gold-glow',
    preview: 'border-2 border-amber-400 rounded-full border-gold-glow',
  },
  {
    id: 'fire',
    label: 'Fire/Magma',
    cost: 3000,
    description: 'Animated fire border',
    className: 'border-fire',
    preview: 'border-2 border-red-500 rounded-full border-fire',
  },
];

export function AvatarBorderPicker({ currentBorder, fcBalance, unlockedBorders, onSelect }: AvatarBorderPickerProps) {
  const [selected, setSelected] = useState(currentBorder);

  const handleSelect = (border: typeof BORDERS[0]) => {
    const isOwned = unlockedBorders.includes(border.id);
    if (!isOwned && border.cost > 0 && fcBalance < border.cost) return;
    setSelected(border.id);
    onSelect(border.id);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-3 backdrop-blur-xl"
         style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />
      
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-violet-400" />
        <h3 className="text-[10px] font-black font-orbitron text-violet-300 uppercase tracking-widest"
            style={{ textShadow: '0 0 8px rgba(139,92,246,0.3)' }}>
          Avatar Frames
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {BORDERS.map(border => {
          const isSelected = selected === border.id;
          const isOwned = unlockedBorders.includes(border.id);
          const canAfford = border.cost === 0 || isOwned || fcBalance >= border.cost;

          return (
            <button key={border.id}
                    onClick={() => handleSelect(border)}
                    disabled={!canAfford}
                    className={`relative p-2.5 rounded-xl border transition-all duration-300 text-left ${
                      isSelected
                        ? `${border.className} bg-white/8`
                        : canAfford
                          ? 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
                          : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                    }`}>
              {/* Preview circle */}
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-gradient-to-br from-cyan-900/30 to-violet-900/30"
                   style={isSelected ? { boxShadow: '0 0 15px rgba(139,92,246,0.3)' } : {}}>
                <div className={`w-8 h-8 rounded-full ${border.preview}`} />
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="text-[9px] font-black text-white uppercase">{border.label}</div>
                <div className="text-[7px] text-gray-500">{border.description}</div>
                <div className="text-[8px] font-bold mt-1">
                  {border.cost === 0 ? (
                    <span className="text-emerald-400">Free</span>
                  ) : isOwned ? (
                    <span className="text-violet-400">Owned</span>
                  ) : (
                    <span className={canAfford ? 'text-amber-300' : 'text-red-400'}>
                      {border.cost.toLocaleString()} FC
                    </span>
                  )}
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}

              {/* Lock icon for unaffordable & not owned */}
              {!isOwned && !canAfford && border.cost > 0 && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                  <Lock size={8} className="text-gray-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
