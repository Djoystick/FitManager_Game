import React from 'react';
import { X, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

// We can just define the interface here to avoid importing
interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

interface Player {
  id: string;
  name: string;
  position: string;
  ovr: number;
  stamina: number;
  stats?: PlayerStats;
  traits?: string[];
}

interface Props {
  player: Player;
  onClose: () => void;
}

export function PlayerProfileModal({ player, onClose }: Props) {
  const stats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
  
  const statRows = [
    { label: 'Pace', value: stats.pace, color: 'bg-neon-cyan' },
    { label: 'Shooting', value: stats.shooting, color: 'bg-neon-pink' },
    { label: 'Passing', value: stats.passing, color: 'bg-yellow-400' },
    { label: 'Defending', value: stats.defending, color: 'bg-blue-500' },
    { label: 'Physical', value: stats.physical, color: 'bg-green-500' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-gray-950 border border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,255,0.15)] rounded-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-start bg-gradient-to-b from-neon-cyan/10 to-transparent">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-xl bg-black/60 border border-neon-cyan/40 shadow-[inset_0_0_15px_rgba(0,255,255,0.2)] flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{player.ovr}</span>
              <span className="text-[10px] font-bold text-neon-cyan uppercase">{player.position}</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">{player.name}</h2>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Activity size={12} className={player.stamina > 50 ? 'text-neon-green' : 'text-red-500'} />
                <span>Stamina: {player.stamina}%</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors bg-black/40 rounded-full border border-gray-800 hover:border-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="p-5 flex flex-col gap-5">
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
              <Zap size={12} className="text-neon-pink" /> Detailed Stats
            </h3>
            <div className="flex flex-col gap-3">
              {statRows.map(stat => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-16 uppercase tracking-wider">{stat.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                    <div className={`h-full ${stat.color} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, stat.value))}%` }} />
                  </div>
                  <span className="text-xs font-black text-white w-6 text-right">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traits */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 border-t border-gray-800 pt-4">
              Special Traits
            </h3>
            <div className="flex flex-wrap gap-2">
              {player.traits && player.traits.length > 0 ? (
                player.traits.map(trait => (
                  <span key={trait} className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-purple-900/40 text-purple-300 border border-purple-500/50 rounded-md shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                    {trait}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-600 italic">Нет особых черт</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
