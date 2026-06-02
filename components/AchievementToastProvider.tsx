'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// AchievementToastProvider
//
// Polls the /api/achievements/unseen endpoint every 30s.
// When achievements are found, shows them as a full-screen cinematic modal
// with staggered animations, one achievement at a time.
// All underlying polling / marking API logic is unchanged from the original.
// ─────────────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardFC: number;
  rewardTON: number;
}

const POLL_INTERVAL = 30_000;

// Particle colors for burst effect
const PARTICLE_COLORS = [
  '#9333ea', '#00f0ff', '#39ff14', '#fbbf24', '#f43f5e',
  '#a78bfa', '#67e8f9', '#86efac', '#fcd34d', '#fb7185',
  '#c084fc', '#22d3ee', '#4ade80', '#facc15', '#f87171',
];

function AchievementModal({
  achievement,
  onDismiss,
}: {
  achievement: Achievement;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onDismiss}
      style={{ willChange: 'opacity' }}
    >
      {/* ── Full-screen radial flash ────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(147,51,234,0.5), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Dark backdrop ──────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* ── Burst particles ────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-2.5 h-2.5 rounded-full particle-${i + 1}`}
            style={{ backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length] }}
          />
        ))}
      </div>

      {/* ── Achievement card ───────────────────────────────────────────────── */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.75, y: -60 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}
        className="relative z-10 w-[85vw] max-w-[320px] rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(5,6,15,0.98) 0%, rgba(30,10,50,0.98) 100%)',
          border: '1px solid rgba(147,51,234,0.4)',
          boxShadow: '0 0 60px rgba(147,51,234,0.5), 0 0 120px rgba(147,51,234,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />

        {/* Top banner */}
        <div className="px-6 pt-5 pb-3 text-center">
          <motion.div
            className="text-[9px] font-black uppercase tracking-[0.3em] text-violet-400 mb-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            ✦ Achievement Unlocked ✦
          </motion.div>

          {/* Icon with bounce animation */}
          <motion.div
            className="text-6xl mb-3 achievement-icon-bounce inline-block"
            style={{ filter: 'drop-shadow(0 0 20px rgba(147,51,234,0.8))' }}
          >
            {achievement.icon}
          </motion.div>
        </div>

        {/* Name & description */}
        <div className="px-6 pb-4 text-center">
          <h2
            className="text-lg font-black text-white uppercase tracking-wider font-orbitron mb-1"
            style={{ textShadow: '0 0 20px rgba(147,51,234,0.6)' }}
          >
            {achievement.name}
          </h2>
          <p className="text-gray-400 text-xs leading-relaxed">
            {achievement.description}
          </p>
        </div>

        {/* Rewards */}
        <div
          className="flex items-center justify-center gap-3 px-6 py-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          {achievement.rewardFC > 0 && (
            <motion.div
              className="chip-slide-1 flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              <span className="text-base">🪙</span>
              <div>
                <div className="text-[8px] text-yellow-600 uppercase tracking-widest font-bold">FC</div>
                <div className="text-sm font-black text-yellow-400 font-orbitron leading-none">
                  +{achievement.rewardFC.toLocaleString()}
                </div>
              </div>
            </motion.div>
          )}
          {achievement.rewardTON > 0 && (
            <motion.div
              className="chip-slide-2 flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}
            >
              <span className="text-base">💎</span>
              <div>
                <div className="text-[8px] text-blue-600 uppercase tracking-widest font-bold">TON</div>
                <div className="text-sm font-black text-blue-400 font-orbitron leading-none">
                  +{achievement.rewardTON}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Dismiss hint */}
        <motion.div
          className="text-center py-3 text-[9px] text-gray-600 uppercase tracking-widest cursor-pointer"
          onClick={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Tap to continue
        </motion.div>

        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function AchievementToastProvider() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const [queue,   setQueue]   = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Poll for unseen achievements ─────────────────────────────────────────
  const pollAchievements = useCallback(async () => {
    if (!userId || !isAuthenticated) return;
    try {
      const res = await fetch(`/api/achievements/unseen?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.achievements?.length > 0) {
        setQueue(prev => [...prev, ...data.achievements]);
        // Mark them as seen (fire-and-forget)
        fetch('/api/achievements/mark-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, achievementIds: data.achievements.map((a: Achievement) => a.id) }),
        }).catch(console.error);
      }
    } catch (e) {
      console.error('[AchievementToastProvider]', e);
    }
  }, [userId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    pollAchievements();
    const interval = setInterval(pollAchievements, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated, userId, pollAchievements]);

  // ── Drain queue into current ─────────────────────────────────────────────
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [current, queue]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  if (!mounted || !current) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {current && (
        <AchievementModal
          key={current.id}
          achievement={current}
          onDismiss={handleDismiss}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
