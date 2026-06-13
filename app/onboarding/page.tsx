'use client';

import { useState, useContext, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createStarterFranchise } from '@/app/actions/teamActions';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

import { Shield, Sword, Star, ChevronRight, CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Captain archetype metadata (position → style / strategy)
// ─────────────────────────────────────────────────────────────────────────────
const POSITION_META: Record<string, {
  label: string; color: string; glow: string; borderColor: string;
  Icon: any; strategyKey: string; keyStatLabel: string; keyStatKey: string;
}> = {
  GK:  {
    label: 'Goalkeeper', color: 'from-amber-500 to-orange-600',
    glow: 'rgba(245,158,11,0.55)', borderColor: 'border-amber-500/50',
    Icon: Shield, strategyKey: 'onb_gk_strategy',
    keyStatLabel: 'PHY', keyStatKey: 'physical',
  },
  DEF: {
    label: 'Defender', color: 'from-blue-500 to-cyan-600',
    glow: 'rgba(59,130,246,0.55)', borderColor: 'border-blue-500/50',
    Icon: Shield, strategyKey: 'onb_def_strategy',
    keyStatLabel: 'DEF', keyStatKey: 'defending',
  },
  MID: {
    label: 'Midfielder', color: 'from-purple-500 to-violet-600',
    glow: 'rgba(168,85,247,0.55)', borderColor: 'border-violet-500/50',
    Icon: Star, strategyKey: 'onb_mid_strategy',
    keyStatLabel: 'PAS', keyStatKey: 'passing',
  },
  FWD: {
    label: 'Forward', color: 'from-red-500 to-rose-600',
    glow: 'rgba(239,68,68,0.55)', borderColor: 'border-red-500/50',
    Icon: Sword, strategyKey: 'onb_fwd_strategy',
    keyStatLabel: 'SHO', keyStatKey: 'shooting',
  },
};

function positionGroup(pos: string): keyof typeof POSITION_META {
  if (pos === 'GK') return 'GK';
  if (pos === 'DEF' || ['CB','LB','RB','LWB','RWB'].includes(pos)) return 'DEF';
  if (pos === 'MID' || ['CM','CDM','CAM','LM','RM'].includes(pos)) return 'MID';
  return 'FWD';
}

function getKeyStat(stats: any, key: string): number {
  if (!stats) return 70;
  const direct = stats[key];
  if (typeof direct === 'number') return direct;
  return stats.pace ?? 70;
}

// ─── Typewriter hook ─────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 45) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    setTimeout(() => {
      setDisplayed('');
      let i = 0;
      id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(id);
      }, speed);
    }, 0);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

// ─── Confetti ────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#00f0ff','#ff003c','#f59e0b','#a855f7','#22c55e','#ffffff'];
function Confetti() {
  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${Math.random() * 100}%`, delay: `${Math.random() * 0.8}s`,
      size: Math.random() > 0.5 ? 8 : 5, rotate: Math.random() * 360,
    }))
  );
  return (
    <>
      {particles.map(p => (
        <span key={p.id} className="confetti-particle"
          style={{ left: p.left, top: '-10px', backgroundColor: p.color,
                   width: p.size, height: p.size, animationDelay: p.delay,
                   transform: `rotate(${p.rotate}deg)` }} />
      ))}
    </>
  );
}

// ─── Step dots ───────────────────────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div className="flex gap-2 mb-6">
      {[0, 1, 2].map(i => (
        <div key={i} className={`h-1 rounded-full transition-all duration-500 ${
          i === current
            ? 'w-8 bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]'
            : i < current ? 'w-4 bg-cyan-800' : 'w-4 bg-gray-700'
        }`} />
      ))}
    </div>
  );
}

// ─── Open Captain Card ────────────────────────────────────────────────────────
function CaptainCard({
  player, idx, chosenIdx, onChoose, t,
}: {
  player: any; idx: number; chosenIdx: number | null; onChoose: (i: number) => void; t: any;
}) {
  const group  = positionGroup(player.position || 'MID');
  const meta   = POSITION_META[group];
  const Icon   = meta.Icon;
  const keyStat = getKeyStat(player.stats, meta.keyStatKey);
  const isChosen = chosenIdx === idx;
  const isDimmed = chosenIdx !== null && !isChosen;
  const strategy = (t as any)[meta.strategyKey] || meta.strategyKey;

  return (
    <motion.div
      className={`relative flex-1 rounded-2xl overflow-hidden cursor-pointer
                  border-2 transition-all duration-300
                  bg-black/70 backdrop-blur-md
                  ${isDimmed ? 'opacity-25 pointer-events-none' : ''}
                  ${isChosen ? meta.borderColor : 'border-white/10 hover:border-white/20'}`}
      onClick={() => !isDimmed && onChoose(idx)}
      animate={isChosen ? { scale: 1.06, y: -6 } : { scale: 1, y: 0 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={isChosen ? { boxShadow: `0 0 28px ${meta.glow}` } : {}}
    >
      {/* Gradient top strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${meta.color}`} />

      {/* Background glow blob */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-25"
           style={{ background: `radial-gradient(circle, ${meta.glow}, transparent)` }} />

      <div className="relative z-10 p-3 flex flex-col gap-2">
        {/* Header: position + star if chosen */}
        <div className="flex items-center justify-between min-h-[20px]">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider
                            bg-gradient-to-r ${meta.color} text-white leading-none`}>
            {player.position}
          </span>
          {isChosen && <span className="text-yellow-300 text-sm animate-bounce">⭐</span>}
        </div>

        {/* Icon circle */}
        <div className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center
                         bg-gradient-to-br ${meta.color}`}
             style={{ boxShadow: `0 0 12px ${meta.glow}` }}>
          <Icon size={18} className="text-white" />
        </div>

        {/* OVR */}
        <div className="text-center leading-none">
          <div className="text-[22px] font-black font-orbitron text-white">{player.ovr ?? '—'}</div>
          <div className="text-[8px] text-gray-500 uppercase tracking-widest">OVR</div>
        </div>

        {/* Key stat pill */}
        <div className="flex items-center justify-between bg-white/5 rounded-lg px-2 py-1">
          <span className="text-[9px] text-gray-500 font-bold uppercase">{meta.keyStatLabel}</span>
          <span className="text-[11px] font-black text-white font-orbitron">{keyStat}</span>
        </div>

        {/* Name */}
        <div className="text-[11px] font-black text-white text-center truncate leading-tight">
          {player.name || player.position}
        </div>

        {/* Strategy hint (dimmed until chosen) */}
        <div className={`text-center text-[8px] font-bold uppercase tracking-wider py-1 rounded-lg
                         transition-colors duration-300
                         ${isChosen ? 'text-cyan-300 bg-cyan-500/10' : 'text-gray-700'}`}>
          {strategy}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { userId } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];


  const [screen,        setScreen]        = useState(0);
  const [teamName,      setTeamName]      = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCreating,    setIsCreating]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [showConfetti,  setShowConfetti]  = useState(false);
  const [topPlayers,    setTopPlayers]    = useState<any[]>([]);
  const [chosenIdx,     setChosenIdx]     = useState<number | null>(null);

  const tagline = useTypewriter('Your club. Your legend.', 55);

  // ── Create franchise ───────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !agreedToTerms) return;
    setIsCreating(true);
    setErrorMsg(null);

    const res = await createStarterFranchise(teamName.trim());

    if (res.success) {
      if (res.players && res.players.length > 0) {
        setTopPlayers(
          res.players
            .sort((a: any, b: any) => (b.ovr || 0) - (a.ovr || 0))
            .slice(0, 3)
        );
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2600);
      setTimeout(() => setScreen(2), 600);
    } else {
      setErrorMsg(res.error || 'Failed to create franchise.');
    }
    setIsCreating(false);
  };

  // ── Choose captain ─────────────────────────────────────────────────────────
  const handleChoose = (idx: number) => {
    if (chosenIdx !== null) return;
    setChosenIdx(idx);
  };

  // ── Start game ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    router.push('/');
    router.refresh();
  }, [router]);

  // ── Default captain fallback (if API failed) ───────────────────────────────
  const displayPlayers = topPlayers.length > 0 ? topPlayers : [
    { name: 'Ricardo Santos', position: 'GK', ovr: 72, stats: { physical: 74 } },
    { name: 'Marcus Webb',    position: 'CB', ovr: 68, stats: { defending: 71 } },
    { name: 'Leon Díaz',      position: 'CF', ovr: 75, stats: { shooting: 77 } },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-hidden relative flex flex-col items-center justify-center bg-[#060913]">
      <div className="stars-layer opacity-60" />
      <div className="stars-layer stars-layer-fast opacity-30" />
      <div className="absolute inset-0 pointer-events-none
                      bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,240,255,0.06)_0%,transparent_70%)]" />
      {showConfetti && <Confetti />}

      <div className="relative z-10 w-full max-w-sm px-5 flex flex-col items-center">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════
              SCREEN 0 — WELCOME
          ════════════════════════════════════════════════════════ */}
          {screen === 0 && (
            <motion.div key="screen-0" className="w-full flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.45 }}>
              <StepDots current={0} />

              <div className="w-28 h-28 rounded-full border border-cyan-500/40 mb-7
                              flex items-center justify-center bg-black/60
                              shadow-[0_0_50px_rgba(0,240,255,0.25)] backdrop-blur-md
                              neon-glow-pulse relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/10 to-transparent" />
                <span className="text-5xl font-black font-orbitron text-cyan-400
                                 drop-shadow-[0_0_12px_rgba(0,240,255,0.9)] relative z-10">FM</span>
              </div>

              <h1 className="text-3xl font-black font-orbitron text-white mb-2 tracking-wide
                             drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">FitManager</h1>
              <p className="text-cyan-400 font-orbitron text-sm tracking-widest mb-2 h-5 typewriter-cursor">
                {tagline}
              </p>

              <div className="bg-black/50 backdrop-blur-md border border-cyan-500/20
                              p-4 rounded-2xl shadow-[0_0_20px_rgba(0,240,255,0.08)] mb-8 mt-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  {t.onb_welcome_desc}
                </p>
              </div>

              <motion.button onClick={() => setScreen(1)}
                className="w-full py-4 rounded-2xl font-bold font-orbitron text-black
                           uppercase tracking-widest btn-shimmer active:scale-95
                           shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-transform"
                whileTap={{ scale: 0.96 }}>
                {t.onb_create_club} <ChevronRight className="inline ml-1 -mt-0.5" size={16} />
              </motion.button>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════
              SCREEN 1 — CREATE CLUB
          ════════════════════════════════════════════════════════ */}
          {screen === 1 && (
            <motion.div key="screen-1" className="w-full"
              initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.35 }}>
              <div className="flex flex-col items-center mb-5">
                <StepDots current={1} />
                <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wide">
                  {t.onb_found_club}
                </h2>
                <p className="text-gray-400 text-xs mt-1 tracking-wider">{t.onb_captain_hint}</p>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6
                              shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
                <form onSubmit={handleCreate} className="flex flex-col gap-5">
                  <div className="relative">
                    <label className="absolute -top-2.5 left-4 text-[10px] text-cyan-400
                                     uppercase tracking-[0.2em] font-bold">
                      {t.onb_club_name}
                    </label>
                    <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
                      placeholder={t.onb_club_name_placeholder || 'e.g. Neon City FC'} required maxLength={25}
                      className="w-full bg-black/60 border border-gray-700 text-white font-bold
                                 rounded-xl p-4 pt-5 focus:outline-none focus:border-cyan-400
                                 focus:ring-1 focus:ring-cyan-400 transition-all duration-300
                                 placeholder:text-gray-600 text-sm" />
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

                  <label className="flex items-start gap-3 cursor-pointer">
                    <div onClick={() => setAgreedToTerms(v => !v)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center
                                  transition-all cursor-pointer ${
                        agreedToTerms
                          ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                          : 'border-gray-600 bg-black/40'
                      }`}>
                      {agreedToTerms && <CheckCircle size={12} className="text-black" />}
                    </div>
                    <span className="text-xs text-gray-400 leading-relaxed">
                      {t.onb_agree_terms}{' '}
                      <Link href="/terms" className="text-cyan-400 hover:underline">{t.onb_terms_link}</Link>
                      {' '}{t.onb_and}{' '}
                      <Link href="/privacy" className="text-cyan-400 hover:underline">{t.onb_privacy_link}</Link>.
                    </span>
                  </label>

                  <motion.button type="submit"
                    disabled={isCreating || !teamName.trim() || !agreedToTerms}
                    className={`w-full py-4 rounded-xl font-bold font-orbitron uppercase
                                tracking-widest transition-all duration-300 ${
                      isCreating || !teamName.trim() || !agreedToTerms
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'btn-shimmer text-black shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                    }`}
                    whileTap={{ scale: 0.97 }}>
                    {isCreating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                        {t.onb_founding_club}
                      </span>
                    ) : `${t.onb_found_club} ⚡`}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════
              SCREEN 2 — CAPTAIN SELECTION (Open cards, all data visible)
          ════════════════════════════════════════════════════════ */}
          {screen === 2 && (
            <motion.div key="screen-2" className="w-full flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <StepDots current={2} />

              <h2 className="text-xl font-black font-orbitron text-white uppercase tracking-wide mb-1">
                {t.onb_choose_captain}
              </h2>
              <p className="text-gray-400 text-xs tracking-wider mb-4 text-center">
                {t.onb_captain_hint}
              </p>

              {/* Hint badge */}
              <AnimatePresence>
                {chosenIdx === null && (
                  <motion.div
                    className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full
                                bg-violet-500/10 border border-violet-500/25"
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}>
                    <Zap size={10} className="text-violet-400" />
                    <span className="text-[9px] text-violet-300 font-bold uppercase tracking-wider">
                      {t.onb_captain_click}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cards — all open, all data visible */}
              <div className="flex gap-2.5 w-full justify-center mb-5">
                {displayPlayers.map((p, idx) => (
                  <CaptainCard
                    key={idx} player={p} idx={idx}
                    chosenIdx={chosenIdx} onChoose={handleChoose} t={t}
                  />
                ))}
              </div>

              {/* Strategy ribbon (appears after pick) */}
              <AnimatePresence>
                {chosenIdx !== null && (() => {
                  const chosen = displayPlayers[chosenIdx];
                  const group = positionGroup(chosen?.position || 'MID');
                  const meta = POSITION_META[group];
                  return (
                    <motion.div
                      className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl mb-4
                                  border ${meta.borderColor} bg-white/3`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}>
                      <span className="text-white text-xs font-bold">
                        🎯 {t.onb_strategy} <span className="text-cyan-300">{(t as any)[meta.strategyKey] || meta.strategyKey}</span>
                      </span>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* CTA */}
              <AnimatePresence>
                {chosenIdx !== null && (
                  <motion.button onClick={handleStart}
                    className="w-full py-4 rounded-2xl font-bold font-orbitron uppercase
                               tracking-widest btn-shimmer text-black active:scale-95
                               shadow-[0_0_30px_rgba(0,240,255,0.5)]"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    whileTap={{ scale: 0.97 }}>
                    🚀 {t.onb_start_season}
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
