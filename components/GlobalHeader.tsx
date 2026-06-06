'use client';

import { useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import Link from 'next/link';
import { Settings } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// GlobalHeader — Sticky top bar with:
//   LEFT:   Manager Level pill + VIP crown icon + Energy lightning icon
//   CENTER: Currency chips (TON · FC · SP)
//   RIGHT:  Settings icon
// ─────────────────────────────────────────────────────────────────────────────

interface UserData {
  balance_fancoins:  number;
  sweat_points:      number;
  cardio_coin:       number;
  fitness_coin:      number;
  ball_coin:         number;
  strength_coin:     number;
  balance_ton:       number;
  manager_level:     number;
  manager_xp:        number;
}

function CrownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
      <path d="M2 19l2-10 4 5 4-9 4 9 4-5 2 10H2z" />
    </svg>
  );
}

function EnergyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-cyan-400">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function GlobalHeader() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const pathname = usePathname();
  const t = dict[language as keyof typeof dict];
  const [userData, setUserData] = useState<UserData | null>(null);
  const [animatingFC, setAnimatingFC] = useState(false);
  const [animatingSP, setAnimatingSP] = useState(false);

  const fetchBalances = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/me?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const next: UserData = json.user;

      if (userData) {
        if (next.balance_fancoins !== userData.balance_fancoins) {
          setAnimatingFC(true);
          setTimeout(() => setAnimatingFC(false), 500);
        }
        if (next.sweat_points !== userData.sweat_points) {
          setAnimatingSP(true);
          setTimeout(() => setAnimatingSP(false), 500);
        }
      }
      setUserData(next);
    } catch (e) {
      console.error('[GlobalHeader] fetchBalances error:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      setTimeout(() => fetchBalances(), 0);
    }
    const handleBalanceUpdate = () => setTimeout(() => fetchBalances(), 0);
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  if (!isAuthenticated || !userId || pathname === '/onboarding') return null;

  const fc  = userData?.balance_fancoins ?? 0;
  const sp  = userData?.sweat_points     ?? 0;
  const ton = userData?.balance_ton      ?? 0;
  const lvl = userData?.manager_level    ?? 1;

  return (
    <div className="w-full sticky top-0 z-50 flex-shrink-0">
      {/* Top shimmer line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

      <div className="w-full bg-[#05060f]/90 backdrop-blur-xl border-b border-white/5 px-3 pb-2 pt-10 shadow-[0_4px_24px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-2">

          {/* ── LEFT: Level + VIP + Energy ─────────────────────────── */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Manager Level Pill */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full
                            bg-gradient-to-r from-cyan-500/15 to-violet-500/15
                            border border-cyan-500/30
                            shadow-[0_0_10px_rgba(0,240,255,0.15)]">
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">LVL</span>
              <span className="text-xs font-black font-orbitron text-cyan-300 leading-none">{lvl}</span>
            </div>

            {/* VIP Crown */}
            <button className="w-6 h-6 rounded-full flex items-center justify-center
                                bg-yellow-500/10 border border-yellow-500/25
                                hover:bg-yellow-500/20 transition-colors active:scale-90">
              <CrownIcon />
            </button>

            {/* Energy */}
            <button className="w-6 h-6 rounded-full flex items-center justify-center
                                bg-cyan-500/10 border border-cyan-500/25
                                hover:bg-cyan-500/20 transition-colors active:scale-90">
              <EnergyIcon />
            </button>
          </div>

          {/* ── CENTER: Currency chips ──────────────────────────────── */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {/* TON chip */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full
                            bg-blue-500/10 border border-blue-500/25">
              <span className="text-[9px] text-blue-400">💎</span>
              <span className="text-[10px] font-black font-orbitron text-blue-300 tracking-wide">
                {Number(ton).toFixed(2)}
              </span>
            </div>

            <div className="h-3 w-px bg-white/10" />

            {/* FC chip */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all duration-300 ${
              animatingFC
                ? 'bg-yellow-400/25 border border-yellow-400/60 shadow-[0_0_12px_rgba(250,204,21,0.6)]'
                : 'bg-yellow-500/10 border border-yellow-500/25'
            }`}>
              <span className={`text-[8px] font-black leading-none ${animatingFC ? 'text-yellow-300' : 'text-yellow-500'}`}>FC</span>
              <span className={`text-[10px] font-black font-orbitron tracking-wide transition-colors duration-300 ${
                animatingFC ? 'text-yellow-200' : 'text-yellow-400'
              }`}>
                {fc.toLocaleString('en-US')}
              </span>
            </div>

            <div className="h-3 w-px bg-white/10" />

            {/* SP chip */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all duration-300 ${
              animatingSP
                ? 'bg-cyan-400/25 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                : 'bg-cyan-500/10 border border-cyan-500/25'
            }`}>
              <span className={`text-[8px] font-black leading-none ${animatingSP ? 'text-cyan-200' : 'text-cyan-400'}`}>SP</span>
              <span className={`text-[10px] font-black font-orbitron tracking-wide transition-colors duration-300 ${
                animatingSP ? 'text-white' : 'text-cyan-300'
              }`}>
                {sp.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* ── RIGHT: Settings ─────────────────────────────────────── */}
          <Link
            href="/profile"
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                       bg-white/5 border border-white/10
                       hover:border-violet-500/40 hover:bg-violet-500/10
                       transition-all duration-200 active:scale-90"
          >
            <Settings size={13} className="text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
