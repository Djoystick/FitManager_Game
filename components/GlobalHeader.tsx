'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { resolveBilingual } from '@/lib/types';
import Link from 'next/link';
import { Settings } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// GlobalHeader — Sticky top bar with:
//   LEFT:   Manager Level pill + Notifications (Bell) + Quick Store (Energy)
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

interface Notification {
  id: string;
  type: 'transfer' | 'injury' | 'challenge' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  transfer: '💰',
  injury: '🚑',
  challenge: '⚔️',
  system: '📢',
  friend_request: '👋',
};

function CrownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
      <path d="M2 19l2-10 4 5 4-9 4 9 4-5 2 10H2z" />
    </svg>
  );
}

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={hasUnread ? 'text-cyan-400' : 'text-gray-400'}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {hasUnread && <circle cx="18" cy="4" r="3" fill="#00f0ff" stroke="none" />}
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

function getTimeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ru' ? 'только что' : 'just now';
  if (mins < 60) return `${mins}${lang === 'ru' ? 'м' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === 'ru' ? 'ч' : 'h'}`;
  const days = Math.floor(hrs / 24);
  return `${days}${lang === 'ru' ? 'д' : 'd'}`;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/social/personal-notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const data: Notification[] = json.notifications ?? [];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (e) {
      console.error('[GlobalHeader] fetchNotifications error:', e);
    }
  }, [userId]);

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
      setTimeout(() => {
        fetchBalances();
        fetchNotifications();
      }, 0);
    }
    const handleBalanceUpdate = () => setTimeout(() => fetchBalances(), 0);
    const handleOpenNotifications = () => setShowNotifications(true);
    
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    window.addEventListener('openNotifications', handleOpenNotifications);
    
    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
      window.removeEventListener('openNotifications', handleOpenNotifications);
    };
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

              {/* Notifications / Activity Log (Bell icon) */}
              <button
                id="header-notifications-btn"
                onClick={() => {
                  setShowNotifications(true);
                }}
                className="relative w-6 h-6 rounded-full flex items-center justify-center
                            bg-cyan-500/10 border border-cyan-500/25
                            hover:bg-cyan-500/20 transition-colors active:scale-90"
                aria-label="Notifications"
              >
                <BellIcon hasUnread={unreadCount > 0} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full
                                   bg-cyan-400 border border-[#05060f] flex items-center justify-center
                                   text-[7px] font-black text-[#05060f] animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
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

            {/* ── RIGHT: Empty placeholder to maintain center alignment ── */}
            <div className="flex-shrink-0 w-7 h-7" />
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
            className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] z-[85] rounded-t-3xl"
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
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
                <span className="text-xs font-black font-orbitron text-white uppercase tracking-widest">
                  {t?.activity_news || 'Уведомления'}
                </span>
                {unreadCount > 0 && (
                  <span className="text-[8px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-400
                                   px-1.5 py-0.5 rounded-full font-bold uppercase">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      await fetch('/api/social/personal-notifications', { method: 'POST' });
                      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                      setUnreadCount(0);
                    }}
                    className="text-[8px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider transition-colors"
                  >
                    {language === 'ru' ? 'Прочитать все' : 'Read all'}
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-7 h-7 rounded-full bg-white/5 border border-white/10
                             flex items-center justify-center text-gray-400 text-xs
                             hover:text-white transition-colors active:scale-90"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification rows */}
            <div className="px-4 py-3 flex flex-col gap-2 pb-10">
              {notifications.length === 0 && (
                <p className="text-center text-[10px] text-gray-600 py-6">
                  {language === 'ru' ? 'Нет уведомлений' : 'No notifications yet'}
                </p>
              )}
              {notifications.slice(0, 10).map((n) => {
                const icon = TYPE_ICONS[n.type] ?? '📢';
                const timeAgo = getTimeAgo(n.created_at, language);
                return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                    n.is_read
                      ? 'bg-white/[0.02] border-white/5 opacity-55'
                      : 'bg-cyan-500/5 border-cyan-500/20 shadow-[0_0_12px_rgba(0,240,255,0.04)]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center
                                  bg-black/40 border border-white/8 flex-shrink-0 text-base">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-white uppercase tracking-wide">{n.title}</span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                    </div>
                    <p className="text-[9px] text-gray-500 leading-snug">{resolveBilingual(n.message, language)}</p>
                  </div>
                  <span className="text-[8px] text-gray-700 font-mono flex-shrink-0 pt-0.5">{timeAgo}</span>
                </div>
              )})}

              {notifications.length > 0 && (
                <Link
                  href="/social"
                  onClick={() => setShowNotifications(false)}
                  className="text-center text-[9px] text-cyan-400 uppercase tracking-widest font-bold mt-2 hover:text-cyan-300 transition-colors"
                >
                  {language === 'ru' ? 'Все уведомления →' : 'All notifications →'}
                </Link>
              )}
            </div>
          </div>

          {/* Slide-up keyframe (CSS-only, no framer-motion dep required here) */}
          <style>{`
            @keyframes globalHeaderSheetUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
}
