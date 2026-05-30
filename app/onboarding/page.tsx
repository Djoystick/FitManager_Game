'use client';

import { useState, useContext, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createStarterFranchise } from '@/app/actions/teamActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useTutorial } from '@/components/providers/TutorialContext';
import { Shield, Sword, Star, ChevronRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Captain archetypes for the "pack opening" screen (Step 3)
// These are cosmetic only — they display the user's actual top-3 players
// after team creation, giving the illusion of a "choice".
// ─────────────────────────────────────────────────────────────────────────────
const POSITION_META: Record<string, { label: string; color: string; glow: string; Icon: any }> = {
  GK: { label: 'Goalkeeper', color: 'from-amber-500 to-orange-600',   glow: 'rgba(245,158,11,0.6)',  Icon: Shield },
  DEF:{ label: 'Defender',   color: 'from-blue-500 to-cyan-600',      glow: 'rgba(59,130,246,0.6)',  Icon: Shield },
  MID:{ label: 'Midfielder', color: 'from-purple-500 to-violet-600',  glow: 'rgba(168,85,247,0.6)', Icon: Star   },
  FWD:{ label: 'Forward',    color: 'from-red-500 to-rose-600',       glow: 'rgba(239,68,68,0.6)',   Icon: Sword  },
};

function positionGroup(pos: string) {
  if (pos === 'GK') return 'GK';
  if (['CB','LB','RB','LWB','RWB'].includes(pos)) return 'DEF';
  if (['CM','CDM','CAM','LM','RM'].includes(pos)) return 'MID';
  return 'FWD';
}

// ─── Typewriter hook ─────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 45) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    setTimeout(() => {
      setDisplayed('');
      setDone(false);
      let i = 0;
      id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(id); setDone(true); }
      }, speed);
    }, 0);
    return () => clearInterval(id);
  }, [text, speed]);
  return { displayed, done };
}

// ─── Confetti burst ──────────────────────────────────────────────────────────
const COLORS = ['#00f0ff','#ff003c','#f59e0b','#a855f7','#22c55e','#ffffff'];
function Confetti() {
  const [particles] = useState(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.8}s`,
    size: Math.random() > 0.5 ? 8 : 5,
    rotate: Math.random() * 360,
  })));
  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left, top: '-10px',
            backgroundColor: p.color,
            width: p.size, height: p.size,
            animationDelay: p.delay,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div className="flex gap-2 mb-6">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-500 ${
            i === current
              ? 'w-8 bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]'
              : i < current
                ? 'w-4 bg-cyan-800'
                : 'w-4 bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { userId } = useContext(TelegramAuthContext);
  const { nextStep, setUserId } = useTutorial();

  // Screens: 0 = Welcome, 1 = Create Club, 2 = Captain Pick
  const [screen, setScreen] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Top-3 players fetched after team creation
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);

  // ── Screen 0: Welcome typewriter ─────────────────────────────────────────
  const { displayed: tagline, done: taglineDone } = useTypewriter(
    'Your club. Your legend.',
    55
  );

  // ── Submit: Create Team ───────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !agreedToTerms) return;
    setIsCreating(true);
    setErrorMsg(null);

    const res = await createStarterFranchise(teamName.trim());

    if (res.success) {
      // Fetch top-3 players from the generated squad
      try {
        const teamRes = await fetch(`/api/team/my-team?userId=${userId}`);
        if (teamRes.ok) {
          const data = await teamRes.json();
          const sorted = (data.players || [])
            .sort((a: any, b: any) => (b.ovr || 0) - (a.ovr || 0))
            .slice(0, 3);
          setTopPlayers(sorted);
        }
      } catch {}
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2600);
      setTimeout(() => setScreen(2), 600);
    } else {
      setErrorMsg(res.error || 'Failed to create franchise.');
    }
    setIsCreating(false);
  };

  // ── Captain flip + finish ─────────────────────────────────────────────────
  const handleFlip = (idx: number) => {
    if (chosenIdx !== null) return;
    setFlippedIdx(idx);
    setTimeout(() => setChosenIdx(idx), 350);
  };

  const handleStart = useCallback(() => {
    if (userId) setUserId(userId);
    nextStep(); // advance from step 0 → 1 (VIEW_SQUAD)
    router.push('/');
    router.refresh();
  }, [userId, nextStep, router, setUserId]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-hidden relative flex flex-col items-center justify-center bg-[#060913]">

      {/* ── Star background ─────────────────────────────────────────────── */}
      <div className="stars-layer opacity-60" />
      <div className="stars-layer stars-layer-fast opacity-30" />

      {/* ── Radial glow ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,240,255,0.06)_0%,transparent_70%)] pointer-events-none" />

      {showConfetti && <Confetti />}

      {/* ── Screens (AnimatePresence) ─────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm px-5 flex flex-col items-center">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 0 — WELCOME
          ════════════════════════════════════════════════════════════════ */}
          {screen === 0 && (
            <motion.div
              key="screen-welcome"
              className="w-full flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.45 }}
            >
              <StepDots current={0} />

              {/* Logo */}
              <div className="w-28 h-28 rounded-full border border-cyan-500/40 mb-7
                              flex items-center justify-center bg-black/60
                              shadow-[0_0_50px_rgba(0,240,255,0.25)] backdrop-blur-md
                              neon-glow-pulse relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/10 to-transparent" />
                <span className="text-5xl font-black font-orbitron text-cyan-400
                                 drop-shadow-[0_0_12px_rgba(0,240,255,0.9)] relative z-10">
                  FM
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-black font-orbitron text-white mb-2 tracking-wide
                             drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                FitManager
              </h1>

              {/* Typewriter tagline */}
              <p className="text-cyan-400 font-orbitron text-sm tracking-widest mb-2 h-5 typewriter-cursor">
                {tagline}
              </p>

              {/* Description */}
              <div className="bg-black/50 backdrop-blur-md border border-cyan-500/20
                              p-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.08)] mb-8 mt-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  Web3 симулятор футбольного менеджера нового поколения.
                  Тренируй атлетов, торгуй на рынке за <span className="text-cyan-400 font-bold">TON</span> и
                  покори Высшую Лигу.
                </p>
              </div>

              <motion.button
                onClick={() => setScreen(1)}
                className="w-full py-4 rounded-2xl font-bold font-orbitron text-black
                           uppercase tracking-widest btn-shimmer active:scale-95
                           shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-transform"
                whileTap={{ scale: 0.96 }}
              >
                Создать клуб
                <ChevronRight className="inline ml-1 -mt-0.5" size={16} />
              </motion.button>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 1 — CREATE CLUB
          ════════════════════════════════════════════════════════════════ */}
          {screen === 1 && (
            <motion.div
              key="screen-create"
              className="w-full"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex flex-col items-center mb-5">
                <StepDots current={1} />
                <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wide">
                  Основать клуб
                </h2>
                <p className="text-gray-400 text-xs mt-1 tracking-wider">
                  Дай имя своей легенде
                </p>
              </div>

              {/* Glassmorphism form card */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10
                              rounded-3xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
                <form onSubmit={handleCreate} className="flex flex-col gap-5">

                  {/* Team name input */}
                  <div className="relative">
                    <label className="absolute -top-2.5 left-4 bg-transparent
                                     text-[10px] text-cyan-400 uppercase tracking-[0.2em] font-bold z-10">
                      Название клуба
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      placeholder="e.g. Neon City FC"
                      required
                      maxLength={25}
                      className="w-full bg-black/60 border border-gray-700 text-white font-bold
                                 rounded-xl p-4 pt-5 focus:outline-none focus:border-cyan-400
                                 focus:ring-1 focus:ring-cyan-400 transition-all duration-300
                                 placeholder:text-gray-600 text-sm"
                    />
                    {/* Live preview */}
                    {teamName && (
                      <div className="mt-2 flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600
                                        flex items-center justify-center text-[10px] font-black text-black">
                          {teamName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-cyan-300 text-xs font-bold">{teamName}</span>
                      </div>
                    )}
                  </div>

                  {errorMsg && (
                    <div className="text-red-400 text-xs text-center font-bold
                                   bg-red-900/20 border border-red-500/30 p-3 rounded-xl">
                      {errorMsg}
                    </div>
                  )}

                  {/* Terms */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div
                      onClick={() => setAgreedToTerms(v => !v)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center
                                  transition-all cursor-pointer ${
                        agreedToTerms
                          ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                          : 'border-gray-600 bg-black/40'
                      }`}
                    >
                      {agreedToTerms && <CheckCircle size={12} className="text-black" />}
                    </div>
                    <span className="text-xs text-gray-400 leading-relaxed">
                      Я согласен с{' '}
                      <Link href="/terms" className="text-cyan-400 hover:underline">Условиями</Link>
                      {' '}и{' '}
                      <Link href="/privacy" className="text-cyan-400 hover:underline">Политикой конфиденциальности</Link>.
                    </span>
                  </label>

                  <motion.button
                    type="submit"
                    disabled={isCreating || !teamName.trim() || !agreedToTerms}
                    className={`w-full py-4 rounded-xl font-bold font-orbitron uppercase
                                tracking-widest transition-all duration-300 relative overflow-hidden ${
                      isCreating || !teamName.trim() || !agreedToTerms
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'btn-shimmer text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isCreating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                        Создаём…
                      </span>
                    ) : (
                      'Основать Клуб ⚡'
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 2 — CAPTAIN SELECTION (Pack Opening)
          ════════════════════════════════════════════════════════════════ */}
          {screen === 2 && (
            <motion.div
              key="screen-captain"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <StepDots current={2} />

              <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wide mb-1">
                Топ игроки
              </h2>
              <p className="text-gray-400 text-xs tracking-wider mb-6">
                Выбери своего капитана
              </p>

              {/* Player cards */}
              <div className="flex gap-3 w-full justify-center mb-8">
                {(topPlayers.length > 0
                  ? topPlayers
                  // fallback if API failed
                  : [
                      { name: 'Ricardo', position: 'GK', ovr: 72 },
                      { name: 'Marcus',  position: 'CB', ovr: 68 },
                      { name: 'Leon',    position: 'CF', ovr: 75 },
                    ]
                ).map((p, idx) => {
                  const group = positionGroup(p.position || 'MID');
                  const meta  = POSITION_META[group] || POSITION_META.MID;
                  const Icon  = meta.Icon;
                  const isFlipped  = flippedIdx === idx;
                  const isChosen   = chosenIdx === idx;
                  const isDimmed   = chosenIdx !== null && !isChosen;

                  return (
                    <motion.div
                      key={idx}
                      className={`card-container flex-1 h-40 cursor-pointer transition-opacity duration-300 ${
                        isDimmed ? 'opacity-30 pointer-events-none' : ''
                      } ${isChosen ? 'flex-[1.4]' : ''}`}
                      onClick={() => handleFlip(idx)}
                      animate={isChosen ? { scale: 1.05 } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
                        {/* CARD FRONT (mystery back) */}
                        <div className="card-face bg-gradient-to-br from-gray-800 to-gray-950
                                        border border-gray-700 flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600
                                          flex items-center justify-center">
                            <span className="text-gray-400 text-xl">?</span>
                          </div>
                          <span className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                            Открыть
                          </span>
                        </div>

                        {/* CARD BACK (revealed player) */}
                        <div
                          className={`card-face card-back bg-gradient-to-br ${meta.color}
                                      flex flex-col items-center justify-center gap-1 relative overflow-hidden`}
                          style={isChosen ? { boxShadow: `0 0 30px ${meta.glow}` } : {}}
                        >
                          {/* Shine sweep */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />

                          <Icon size={24} className="text-white/80 relative z-10" />
                          <span className="text-white font-black text-xs uppercase tracking-wider relative z-10">
                            {group}
                          </span>
                          <div className="bg-black/30 rounded-lg px-3 py-1 relative z-10">
                            <span className="text-white font-black text-2xl font-orbitron">
                              {p.ovr || '—'}
                            </span>
                          </div>
                          <span className="text-white/80 text-[10px] font-bold relative z-10 truncate max-w-[80px]">
                            {p.name || p.position}
                          </span>
                          {isChosen && (
                            <div className="absolute top-2 right-2 z-10">
                              <span className="text-yellow-300 text-lg">⭐</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* CTA — only shown after a captain is chosen */}
              <AnimatePresence>
                {chosenIdx !== null && (
                  <motion.button
                    onClick={handleStart}
                    className="w-full py-4 rounded-2xl font-bold font-orbitron uppercase
                               tracking-widest btn-shimmer text-black active:scale-95
                               shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-transform"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    🚀 Начать сезон!
                  </motion.button>
                )}
              </AnimatePresence>

              {chosenIdx === null && (
                <p className="text-gray-500 text-xs text-center animate-pulse">
                  Нажми на карточку, чтобы открыть
                </p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
