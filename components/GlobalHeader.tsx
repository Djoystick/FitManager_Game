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
//   LEFT:   Manager Level pill + Notifications (Crown) + Quick Store (Energy)
//   CENTER: Currency chips (TON · FC · SP)
//   RIGHT:  Settings icon
//
// TMA note: paddingTop uses env(safe-area-inset-top) so native Telegram buttons
// (back, close) are never obscured by our UI elements.
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

// Mock activity notifications — will be wired to a real activity feed in V4
const MOCK_NOTIFICATIONS = [
  { id: '1', icon: '⚽', title: 'Match Simulated',     desc: 'League round completed — check your results',     time: '2m ago',  read: false },
  { id: '2', icon: '🔄', title: 'Transfer Window',     desc: 'Summer window opens in 3 days',                   time: '1h ago',  read: false },
  { id: '3', icon: '🏆', title: 'Achievement Unlocked', desc: 'First Victory — Win your first match',            time: '3h ago',  read: true  },
] as const;

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
  const [showNotifications, setShowNotifications] = useState(false);

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
    <>
      {/* ── Sticky Header Bar ──────────────────────────────────────────────── */}
      <div className="w-full sticky top-0 z-50 flex-shrink-0">
        {/* Top shimmer line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        {/* Main bar — safe-area-inset-top keeps content below TMA system buttons */}
        <div
          className="w-full bg-[#05060f]/90 backdrop-blur-xl border-b border-white/5 px-3 pt-[85px] pb-2 shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-center justify-between gap-2">

            {/* ── LEFT: Level + Notifications + Quick Store ────────────── */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Manager Level Pill */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full
                              bg-gradient-to-r from-cyan-500/15 to-violet-500/15
                              border border-cyan-500/30
                              shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">LVL</span>
                <span className="text-xs font-black font-orbitron text-cyan-300 leading-none">{lvl}</span>
              </div>

              {/* Notifications / Activity Log (Crown icon) */}
              <button
                id="header-notifications-btn"
                onClick={() => setShowNotifications(true)}
                className="relative w-6 h-6 rounded-full flex items-center justify-center
                            bg-yellow-500/10 border border-yellow-500/25
                            hover:bg-yellow-500/20 transition-colors active:scale-90"
                aria-label="Activity log"
              >
                <CrownIcon />
                {/* Unread badge */}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full
                                 bg-red-500 border border-[#05060f] animate-pulse" />
              </button>

              {/* Quick Store — routes to /bank for Diamond top-up */}
              <Link
                href="/bank"
                id="header-store-btn"
                className="w-6 h-6 rounded-full flex items-center justify-center
                            bg-cyan-500/10 border border-cyan-500/25
                            hover:bg-cyan-500/20 transition-colors active:scale-90"
                aria-label="Quick store"
              >
                <EnergyIcon />
              </Link>
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

      {/* ── Notifications / Activity Drawer ──────────────────────────────── */}
      {showNotifications && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNotifications(false)}
          />

          {/* Bottom sheet */}
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[85] rounded-t-3xl"
            style={{
              background: 'rgba(5,6,15,0.97)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(250,204,21,0.14)',
              borderBottom: 'none',
              boxShadow: '0 -12px 48px rgba(250,204,21,0.07)',
              animation: 'globalHeaderSheetUp 0.3s cubic-bezier(0.32,0.72,0,1) both',
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-yellow-500/30 shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
            </div>

            {/* Sheet header */}
            <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_6px_rgba(250,204,21,0.8)]" />
                <span className="text-xs font-black font-orbitron text-white uppercase tracking-widest">Activity</span>
                <span className="text-[8px] bg-red-500/20 border border-red-500/40 text-red-400
                                 px-1.5 py-0.5 rounded-full font-bold uppercase">2 New</span>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="w-7 h-7 rounded-full bg-white/5 border border-white/10
                           flex items-center justify-center text-gray-400 text-xs
                           hover:text-white transition-colors active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* Notification rows */}
            <div className="px-4 py-3 flex flex-col gap-2 pb-10">
              {MOCK_NOTIFICATIONS.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                    n.read
                      ? 'bg-white/[0.02] border-white/5 opacity-55'
                      : 'bg-yellow-500/5 border-yellow-500/20 shadow-[0_0_12px_rgba(250,204,21,0.04)]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center
                                  bg-black/40 border border-white/8 flex-shrink-0 text-base">
                    {n.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-white uppercase tracking-wide">{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
                    </div>
                    <p className="text-[9px] text-gray-500 leading-snug">{n.desc}</p>
                  </div>
                  <span className="text-[8px] text-gray-700 font-mono flex-shrink-0 pt-0.5">{n.time}</span>
                </div>
              ))}

              <p className="text-center text-[8px] text-gray-700 uppercase tracking-widest font-bold mt-1">
                Live activity feed · coming in V4
              </p>
            </div>
          </div>

          {/* Slide-up keyframe (CSS-only, no framer-motion dep required here) */}
          <style>{`
            @keyframes globalHeaderSheetUp {
              from { transform: translateX(-50%) translateY(100%); opacity: 0; }
              to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
}
