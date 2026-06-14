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

// ── Advanced Sci-Fi SVG Icons ───────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all duration-300">
      {/* Outer tech frame */}
      <path d="M12 2L2 8.5v7L12 22l10-6.5v-7L12 2z" stroke="currentColor" strokeWidth={active ? "1.5" : "1.2"} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.6} />
      {/* Inner glowing element */}
      <path d="M12 6L6 9.8v4.4L12 18l6-3.8V9.8L12 6z" fill={active ? 'rgba(0, 240, 255, 0.2)' : 'none'} stroke={active ? '#00f0ff' : 'currentColor'} strokeWidth="1" strokeLinejoin="round" />
      {/* Core dot */}
      <circle cx="12" cy="12" r={active ? "2" : "1.5"} fill={active ? '#00f0ff' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 4px #00f0ff)' : 'none' }} />
      {/* Cyberpunk accent lines */}
      {active && (
        <>
          <line x1="12" y1="2" x2="12" y2="6" stroke="#00f0ff" strokeWidth="1.5" />
          <line x1="12" y1="18" x2="12" y2="22" stroke="#00f0ff" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

function TeamIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all duration-300">
      {/* Background data grid */}
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.2" strokeDasharray={active ? "none" : "2 2"} opacity={active ? 1 : 0.5} />
      {/* Tactical positions */}
      <circle cx="12" cy="17" r="2" fill={active ? '#00f0ff' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 3px #00f0ff)' : 'none' }} />
      <circle cx="7" cy="12" r="1.5" fill={active ? '#fff' : 'currentColor'} opacity={active ? 0.9 : 0.6} />
      <circle cx="17" cy="12" r="1.5" fill={active ? '#fff' : 'currentColor'} opacity={active ? 0.9 : 0.6} />
      <circle cx="12" cy="7" r="2" fill={active ? '#ff0055' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 4px #ff0055)' : 'none' }} />
      {/* Connection paths */}
      <path d="M12 17L7 12L12 7L17 12Z" stroke={active ? 'rgba(0, 240, 255, 0.5)' : 'currentColor'} strokeWidth="1" strokeLinejoin="round" opacity={active ? 1 : 0.3} />
      {/* Target brackets */}
      {active && (
        <path d="M7 6H5V8M19 6H17V8M5 16V18H7M17 18H19V16" stroke="#00f0ff" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function TransfersIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all duration-300">
      {/* Circular data tracks */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" opacity={active ? 0.8 : 0.4} />
      {/* Arrow top-right to bottom-left */}
      <path d="M16 8L8 16" stroke={active ? '#00f0ff' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 16H13M8 16V11" stroke={active ? '#00f0ff' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Arrow bottom-left to top-right */}
      <path d="M8 8L16 16" stroke={active ? '#ff0055' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 16H11M16 16V11" stroke={active ? '#ff0055' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data nodes */}
      <circle cx="16" cy="8" r={active ? "2" : "1.5"} fill={active ? '#00f0ff' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 4px #00f0ff)' : 'none' }} />
      <circle cx="8" cy="8" r={active ? "2" : "1.5"} fill={active ? '#ff0055' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 4px #ff0055)' : 'none' }} />
    </svg>
  );
}

function SocialIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all duration-300">
      {/* Main person */}
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.2" fill={active ? 'rgba(0,240,255,0.1)' : 'none'} opacity={active ? 1 : 0.6} />
      <path d="M2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={active ? 1 : 0.6} />
      {/* Second person (offset) */}
      <circle cx="16" cy="8" r="2.5" stroke={active ? '#00f0ff' : 'currentColor'} strokeWidth="1.2" fill={active ? 'rgba(0,240,255,0.1)' : 'none'} opacity={active ? 1 : 0.5} />
      <path d="M19 21v-1.5a4 4 0 00-3-3.87" stroke={active ? '#00f0ff' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" opacity={active ? 1 : 0.4} />
      {/* Connection line */}
      {active && (
        <path d="M12 10L14 9" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" opacity={0.6} />
      )}
      {/* Glow dot */}
      <circle cx="9" cy="7" r="1" fill={active ? '#00f0ff' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 4px #00f0ff)' : 'none' }} />
    </svg>
  );
}

function HubIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all duration-300">
      {/* Orbital rings */}
      <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" transform="rotate(45 12 12)" opacity={active ? 0.8 : 0.4} />
      <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" transform="rotate(-45 12 12)" opacity={active ? 0.8 : 0.4} />
      {/* Center energy core */}
      <circle cx="12" cy="12" r={active ? "3" : "2"} fill={active ? '#00f0ff' : 'currentColor'} style={{ filter: active ? 'drop-shadow(0 0 6px #00f0ff)' : 'none' }} />
      {/* Satellite data packets */}
      {active && (
        <>
          <circle cx="19" cy="5" r="1.5" fill="#ff0055" style={{ filter: 'drop-shadow(0 0 3px #ff0055)' }} />
          <circle cx="5" cy="19" r="1.5" fill="#00f0ff" style={{ filter: 'drop-shadow(0 0 3px #00f0ff)' }} />
          <circle cx="5" cy="5" r="1.5" fill="#fff" opacity="0.8" />
          <circle cx="19" cy="19" r="1.5" fill="#fff" opacity="0.8" />
        </>
      )}
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
    if (pathname.startsWith('/social')) return '/social';
    if (pathname.startsWith('/league') || pathname.includes('/league') || pathname.includes('/achievements')) return '/league';
    return pathname;
  })();

  const navItems = [
    { name: 'HOME',      href: '/',        Icon: HomeIcon,      id: 'tab-home'    },
    { name: 'TEAM',      href: '/lineup',  Icon: TeamIcon,      id: 'tab-lineup'  },
    { name: 'TRANSFERS', href: '/market',  Icon: TransfersIcon, id: 'tab-market'  },
    { name: 'SOCIAL',    href: '/social',  Icon: SocialIcon,    id: 'tab-social'  },
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
