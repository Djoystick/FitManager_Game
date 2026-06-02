'use client';

import { useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { Trophy, Lock, Star } from 'lucide-react';

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

type FilterType = 'all' | 'unlocked' | 'locked';

export default function AchievementsPage() {
  const { userId } = useContext(TelegramAuthContext);
  const [achievements, setAchievements] = useState<AchievementConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

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
    if (filter === 'locked')   return !ach.isUnlocked;
    return true;
  });

  const totalRewardsFC  = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.rewardFC, 0);
  const totalRewardsTON = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.rewardTON, 0);
  const unlockedCount   = achievements.filter(a => a.isUnlocked).length;
  const progressPct     = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;
  const circumference   = 2 * Math.PI * 40; // r=40

  return (
    <div
      className="h-full flex flex-col overflow-y-auto custom-scrollbar pb-24"
      style={{ background: '#05060f' }}
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-50" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      {/* ── HEADER CARD ──────────────────────────────────────────────── */}
      <div className="relative z-10 p-4 pb-0">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card-violet relative overflow-hidden p-4"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4">
            {/* Progress circle */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Track */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="7"
                />
                {/* Progress arc */}
                <motion.circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="url(#progressGrad)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference - (circumference * progressPct) / 100 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#00f0ff" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-white font-orbitron leading-none">{unlockedCount}</span>
                <span className="text-[8px] text-violet-400 uppercase tracking-widest font-bold">/{achievements.length}</span>
              </div>
            </div>

            {/* Title + rewards */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-violet-400/70 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
                <Trophy size={9} />
                Hall of Fame
              </div>
              <h1 className="text-xl font-black text-white uppercase tracking-tight font-orbitron mb-2">
                Зал Славы
              </h1>
              <div className="flex items-center gap-3">
                {totalRewardsFC > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🪙</span>
                    <span className="text-sm font-black text-yellow-400 font-orbitron">+{totalRewardsFC.toLocaleString()}</span>
                    <span className="text-[8px] text-yellow-600 font-bold uppercase">FC</span>
                  </div>
                )}
                {totalRewardsTON > 0 && (
                  <>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">💎</span>
                      <span className="text-sm font-black text-blue-400 font-orbitron">+{totalRewardsTON.toFixed(2)}</span>
                      <span className="text-[8px] text-blue-600 font-bold uppercase">TON</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-1">
              <span>Progress</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #9333ea, #00f0ff)', boxShadow: '0 0 8px rgba(147,51,234,0.6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── FILTER PILLS ───────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 mt-3 flex gap-2">
        {(['all', 'unlocked', 'locked'] as const).map(f => {
          const labels: Record<FilterType, { ru: string; color: string; activeClass: string }> = {
            all:      { ru: 'Все',       color: 'text-gray-400',   activeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/50 shadow-[0_0_10px_rgba(147,51,234,0.3)]' },
            unlocked: { ru: 'Открытые', color: 'text-gray-400',   activeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
            locked:   { ru: 'Закрытые', color: 'text-gray-400',   activeClass: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
          };
          const cfg = labels[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-200 ${
                filter === f
                  ? cfg.activeClass
                  : 'bg-white/5 border-white/10 ' + cfg.color + ' hover:text-white'
              }`}
            >
              {cfg.ru}
            </button>
          );
        })}
      </div>

      {/* ── ACHIEVEMENT GRID ───────────────────────────────────────────── */}
      <div className="relative z-10 px-4 mt-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 glass-card animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredAchievements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mb-3">
              <Star className="text-gray-700" size={28} />
            </div>
            <p className="text-gray-600 text-sm font-bold uppercase tracking-widest">No achievements yet</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 gap-2.5">
              {filteredAchievements.map((ach, i) => (
                <motion.div
                  key={ach.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative overflow-hidden rounded-2xl border p-4 flex items-center gap-4 transition-all duration-300 ${
                    ach.isUnlocked
                      ? 'hover:-translate-y-0.5'
                      : 'opacity-50 grayscale hover:grayscale-0 hover:opacity-80'
                  }`}
                  style={ach.isUnlocked ? {
                    background: 'linear-gradient(135deg, rgba(147,51,234,0.06) 0%, rgba(5,6,15,0.9) 100%)',
                    border: '1px solid rgba(147,51,234,0.2)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 20px rgba(147,51,234,0.06)',
                  } : {
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Background glow for unlocked */}
                  {ach.isUnlocked && (
                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />
                  )}

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 relative z-10 ${
                    ach.isUnlocked
                      ? 'shadow-[0_0_20px_rgba(147,51,234,0.4)]'
                      : ''
                  }`}
                    style={ach.isUnlocked ? {
                      background: 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(0,240,255,0.1))',
                      border: '1px solid rgba(147,51,234,0.3)',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {ach.isUnlocked ? ach.icon : <Lock size={20} className="text-gray-700" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-black uppercase tracking-wider text-sm font-orbitron ${
                          ach.isUnlocked ? 'text-white' : 'text-gray-600'
                        }`}>
                          {ach.name}
                        </h3>
                        <p className={`text-[10px] leading-tight mt-0.5 ${
                          ach.isUnlocked ? 'text-gray-400' : 'text-gray-700'
                        }`}>
                          {ach.description}
                        </p>
                      </div>
                      {ach.isUnlocked && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-[8px] text-violet-400 uppercase tracking-widest font-bold">Unlocked</div>
                          {ach.unlockedAt && (
                            <div className="text-[8px] text-gray-600 font-mono">
                              {new Date(ach.unlockedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rewards */}
                    {(ach.rewardFC > 0 || ach.rewardTON > 0) && (
                      <div className="flex gap-2 mt-2">
                        {ach.rewardFC > 0 && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-bold ${
                            ach.isUnlocked
                              ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                              : 'bg-white/5 border-white/5 text-gray-600'
                          }`}>
                            🪙 {ach.rewardFC.toLocaleString()} FC
                          </div>
                        )}
                        {ach.rewardTON > 0 && (
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-bold ${
                            ach.isUnlocked
                              ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                              : 'bg-white/5 border-white/5 text-gray-600'
                          }`}>
                            💎 {ach.rewardTON} TON
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
