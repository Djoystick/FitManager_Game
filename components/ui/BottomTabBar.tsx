'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// BottomTabBar — 5-Tab Cyberpunk Command Dock
//
// Tabs: HOME · TEAM · TRANSFERS · MANAGER · HUB
// ─────────────────────────────────────────────────────────────────────────────

// ── SVG Icons — Modern Cyberpunk Aesthetic ────────────────────────────────────

/** HOME — angular house with neon accent panel */
function HomeIcon({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Roof line */}
      <path d="M2 12L12 3l10 9" />
      {/* Left wall */}
      <path d="M4 10.5V20a1 1 0 0 0 1 1h4v-5h6v5h4a1 1 0 0 0 1-1V10.5" />
      {/* Door */}
      <rect x="9.5" y="15" width="5" height="6" rx="0.5" strokeWidth={active ? 1.8 : 1.4} />
      {/* Accent: small glowing window */}
      <rect x="5" y="12" width="3" height="2.5" rx="0.4" strokeWidth={active ? 1.5 : 1.1}
            fill={active ? 'rgba(0,240,255,0.25)' : 'none'} />
    </svg>
  );
}

/** TEAM — tactical formation grid (3 dots top + 4 dots bottom = squad shape) */
function TeamIcon({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const dotR = active ? 2 : 1.7;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Goalkeeper */}
      <circle cx="12" cy="20.5" r={dotR} fill="currentColor" strokeWidth={0} />
      {/* Defenders row */}
      <circle cx="5.5" cy="15.5" r={dotR} fill="currentColor" strokeWidth={0} />
      <circle cx="12"  cy="15.5" r={dotR} fill="currentColor" strokeWidth={0} />
      <circle cx="18.5" cy="15.5" r={dotR} fill="currentColor" strokeWidth={0} />
      {/* Midfielders row */}
      <circle cx="7"  cy="10" r={dotR} fill="currentColor" strokeWidth={0} />
      <circle cx="17" cy="10" r={dotR} fill="currentColor" strokeWidth={0} />
      {/* Forwards / striker */}
      <circle cx="12" cy="4.5" r={dotR + 0.3} fill="currentColor" strokeWidth={0} />
      {/* Tactical connector lines */}
      <path d="M12 20.5V15.5M5.5 15.5H18.5M7 10H17M12 4.5V10" strokeWidth={active ? 1.3 : 0.9} opacity={0.5} />
    </svg>
  );
}

/** TRANSFERS — two crossing arrows with a spark/lightning bolt at center */
function TransfersIcon({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Down-left arrow */}
      <path d="M18 4L6 16" />
      <path d="M6 10v6h6" />
      {/* Up-right arrow */}
      <path d="M6 20L18 8" />
      <path d="M18 14V8h-6" />
      {/* Center spark — filled polygon */}
      <path d="M13.2 11.2l-1.5 2h1.1l-1.5 2 2.7-2.8h-1.2z"
            fill={active ? 'currentColor' : 'none'}
            strokeWidth={active ? 0.5 : 0}
            opacity={active ? 1 : 0} />
    </svg>
  );
}

/** MANAGER — commander badge: shield outline with rank chevron inside */
function ManagerIcon({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Shield */}
      <path d="M12 3L4 6.5v5C4 16.5 7.5 20.5 12 22c4.5-1.5 8-5.5 8-10.5v-5L12 3z" />
      {/* Inner accent line */}
      <path d="M12 6l-5 2.2v3.3C7 14.5 9.3 17.2 12 18.5" strokeWidth={active ? 1.2 : 0.9} opacity={0.55} />
      {/* Chevron rank pip */}
      <path d="M9 12l3-3 3 3" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M9 15l3-3 3 3" strokeWidth={active ? 1.4 : 1.1} opacity={0.6} />
    </svg>
  );
}

/** HUB — interconnected node network (5 nodes + edges) */
function HubIcon({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const nodeR = active ? 2.2 : 1.9;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Center node */}
      <circle cx="12" cy="12" r={nodeR} fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 0 : sw} />
      {/* Satellite nodes */}
      <circle cx="12" cy="4"  r={nodeR - 0.5} fill="currentColor" strokeWidth={0} />
      <circle cx="20" cy="12" r={nodeR - 0.5} fill="currentColor" strokeWidth={0} />
      <circle cx="12" cy="20" r={nodeR - 0.5} fill="currentColor" strokeWidth={0} />
      <circle cx="4"  cy="12" r={nodeR - 0.5} fill="currentColor" strokeWidth={0} />
      {/* Diagonal accent nodes */}
      <circle cx="18.5" cy="5.5"  r={nodeR - 1} fill="currentColor" strokeWidth={0} opacity={0.6} />
      <circle cx="5.5"  cy="18.5" r={nodeR - 1} fill="currentColor" strokeWidth={0} opacity={0.6} />
      {/* Edges — center to satellites */}
      <line x1="12" y1="9.8"  x2="12" y2="6.2"  strokeWidth={active ? 1.6 : 1.2} />
      <line x1="14.2" y1="12" x2="17.8" y2="12" strokeWidth={active ? 1.6 : 1.2} />
      <line x1="12" y1="14.2" x2="12" y2="17.8" strokeWidth={active ? 1.6 : 1.2} />
      <line x1="9.8" y1="12"  x2="6.2" y2="12"  strokeWidth={active ? 1.6 : 1.2} />
      {/* Diagonal edge */}
      <line x1="13.7" y1="10.3" x2="17.2" y2="6.8" strokeWidth={active ? 1.1 : 0.8} opacity={0.5} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function BottomTabBar() {
  const pathname = usePathname();
  const { language } = useContext(LanguageContext);

  // Map sub-pages to their parent tab for active state
  const activeTab = (() => {
    if (pathname === '/')           return '/';
    if (pathname.startsWith('/lineup') || pathname.startsWith('/base') || pathname.startsWith('/bank') || pathname.startsWith('/staff')) return '/lineup';
    if (pathname.startsWith('/market')) return '/market';
    if (pathname.startsWith('/profile') || pathname.includes('/profile')) return '/profile';
    if (pathname.startsWith('/league') || pathname.includes('/league') || pathname.includes('/achievements')) return '/league';
    return pathname;
  })();

  const navItems = [
    { name: 'HOME',      href: '/',        Icon: HomeIcon,      id: 'tab-home'    },
    { name: 'TEAM',      href: '/lineup',  Icon: TeamIcon,      id: 'tab-lineup'  },
    { name: 'TRANSFERS', href: '/market',  Icon: TransfersIcon, id: 'tab-market'  },
    { name: 'MANAGER',   href: '/profile', Icon: ManagerIcon,   id: 'tab-manager' },
    { name: 'HUB',       href: '/league',  Icon: HubIcon,       id: 'tab-hub'     },
  ];

  // Hide on onboarding
  if (pathname === '/onboarding') return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 w-full max-w-[480px] mx-auto z-50 px-4 pointer-events-none">
      <div
        className="flex items-center justify-between px-2 py-2 rounded-2xl pointer-events-auto shadow-2xl"
        style={{
          background: 'rgba(5,6,15,0.65)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {navItems.map(({ name, href, Icon, id }) => {
          const isActive = activeTab === href;

          return (
            <Link
              key={href}
              href={href}
              id={id}
              aria-label={name}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-1.5 transition-all duration-200 active:scale-90 tap-highlight-transparent"
            >
              {/* Active Pill Background Indicator (Sliding) */}
              {isActive && (
                <motion.div
                  layoutId="tab-active-pill"
                  className="absolute inset-0 rounded-xl bg-cyan-500/15 border border-cyan-400/20"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              {/* Icon */}
              <div className={`relative z-10 transition-all duration-300 ${
                isActive
                  ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] scale-110'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
                <Icon active={isActive} />
              </div>

              {/* Label */}
              <span className={`relative z-10 text-[8px] uppercase font-bold tracking-widest transition-colors duration-300 ${
                isActive ? 'text-cyan-300' : 'text-gray-600'
              }`}>
                {name}
              </span>
              
              {/* Active Dot underneath */}
              {isActive && (
                <motion.div 
                  layoutId="tab-active-dot"
                  className="absolute -bottom-1 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
