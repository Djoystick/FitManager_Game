'use client';

import { useContext, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardFC: number;
  rewardTON: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

export default function AchievementsPage() {
  const { userId } = useContext(TelegramAuthContext);
  const [achievements, setAchievements] = useState<AchievementConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  useEffect(() => {
    async function fetchAchievements() {
      if (!userId) return;
      try {
        const res = await fetch(`/api/achievements?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setAchievements(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAchievements();
  }, [userId]);

  const filteredAchievements = achievements.filter(ach => {
    if (filter === 'unlocked') return ach.isUnlocked;
    if (filter === 'locked') return !ach.isUnlocked;
    return true;
  });

  const totalRewardsFC = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.rewardFC, 0);
  const totalRewardsTON = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.rewardTON, 0);
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;

  return (
      <div className="w-full max-w-4xl mx-auto p-4 md:p-6 min-h-screen pt-20 overflow-y-auto custom-scrollbar">
        
        {/* HEADER */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-neon-cyan/20 blur-3xl rounded-full" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-cyber-dark/80 backdrop-blur-xl border border-neon-cyan/30 p-6 md:p-8 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.1)] flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex flex-col gap-2 relative z-10 text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-white uppercase">
                Зал Славы
              </h1>
              <p className="text-gray-400 text-sm md:text-base font-medium">Открывай достижения и получай награды.</p>
            </div>
            
            <div className="flex gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/10 relative z-10 w-full md:w-auto justify-center">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Получено FC</span>
                <span className="text-xl font-bold text-yellow-400 font-mono">+{totalRewardsFC.toLocaleString()}</span>
              </div>
              <div className="w-[1px] h-10 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Получено TON</span>
                <span className="text-xl font-bold text-blue-400 font-mono">+{totalRewardsTON.toFixed(2)}</span>
              </div>
            </div>

            {/* Progress Circle */}
            <div className="flex items-center justify-center relative w-24 h-24">
               <svg className="w-full h-full transform -rotate-90">
                 <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-800" />
                 <circle 
                   cx="48" cy="48" r="40" 
                   stroke="currentColor" 
                   strokeWidth="6" 
                   fill="transparent" 
                   strokeDasharray="251.2" 
                   strokeDashoffset={251.2 - (251.2 * unlockedCount) / Math.max(achievements.length, 1)}
                   className="text-neon-cyan transition-all duration-1000 ease-out" 
                 />
               </svg>
               <div className="absolute flex flex-col items-center justify-center">
                 <span className="text-xl font-black text-white">{unlockedCount}</span>
                 <span className="text-[10px] text-neon-cyan uppercase tracking-widest font-bold">/{achievements.length}</span>
               </div>
            </div>
          </motion.div>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-full font-bold text-xs md:text-sm uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'all' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'bg-black/50 text-gray-400 border border-white/10 hover:border-neon-cyan/50'}`}
          >
            Все
          </button>
          <button 
            onClick={() => setFilter('unlocked')}
            className={`px-6 py-2 rounded-full font-bold text-xs md:text-sm uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'unlocked' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'bg-black/50 text-gray-400 border border-white/10 hover:border-neon-cyan/50'}`}
          >
            Открытые
          </button>
          <button 
            onClick={() => setFilter('locked')}
            className={`px-6 py-2 rounded-full font-bold text-xs md:text-sm uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'locked' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'bg-black/50 text-gray-400 border border-white/10 hover:border-neon-cyan/50'}`}
          >
            Закрытые
          </button>
        </div>

        {/* GRID */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-32 bg-white/5 animate-pulse rounded-2xl border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
            {filteredAchievements.map((ach, i) => (
              <motion.div
                key={ach.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-300 ${
                  ach.isUnlocked 
                    ? 'bg-gradient-to-br from-black/80 to-neon-cyan/10 border-neon-cyan/40 shadow-[0_0_20px_rgba(0,255,255,0.05)] hover:shadow-[0_0_30px_rgba(0,255,255,0.15)] hover:-translate-y-1' 
                    : 'bg-black/60 border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
                }`}
              >
                {/* Glow for unlocked */}
                {ach.isUnlocked && (
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon-cyan/20 blur-3xl rounded-full pointer-events-none" />
                )}

                <div className="flex items-start justify-between z-10 relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg border ${
                    ach.isUnlocked ? 'bg-black border-neon-cyan/50 shadow-neon-cyan/20' : 'bg-gray-900 border-gray-700'
                  }`}>
                    {ach.icon}
                  </div>
                  
                  {ach.isUnlocked && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-neon-cyan uppercase font-bold tracking-widest">Получено</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="z-10 relative flex-1">
                  <h3 className={`font-black uppercase tracking-wider text-lg mb-1 ${ach.isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                    {ach.name}
                  </h3>
                  <p className="text-gray-400 text-sm leading-tight">
                    {ach.description}
                  </p>
                </div>

                <div className="z-10 relative pt-3 border-t border-white/10 flex items-center gap-3">
                  {ach.rewardFC > 0 && (
                    <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg border border-white/5">
                      <span className="text-yellow-400 text-xs">🪙</span>
                      <span className="text-white font-mono font-bold text-xs">{ach.rewardFC.toLocaleString()}</span>
                    </div>
                  )}
                  {ach.rewardTON > 0 && (
                    <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg border border-white/5">
                      <span className="text-blue-400 text-xs">💎</span>
                      <span className="text-white font-mono font-bold text-xs">{ach.rewardTON} TON</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
  );
}
