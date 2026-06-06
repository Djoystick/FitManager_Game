'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { useTutorial, TUTORIAL_DONE } from '@/components/providers/TutorialContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// BottomTabBar — 5-Tab Cyberpunk Command Dock
//
// Tabs: HOME · TEAM · TRANSFERS · MANAGER · HUB
//
// Lock rules (tutorial step):
//   step === 0         → only HOME is unlocked
//   step >= 1          → TEAM unlocked
//   step >= 2          → TEAM + MANAGER unlocked
//   step >= 3          → + TRANSFERS unlocked
//   step >= 4          → + HUB unlocked
//   TUTORIAL_DONE (-1) → all unlocked
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_TOAST_MSG = '🎓 Complete the tutorial first!';

// SVG icons — custom football-game aesthetic
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <path d="M3 12v9h6M15 21h6v-9" />
    </svg>
  );
}

function TeamIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  );
}

function TransfersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function ManagerIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <path d="M14.5 2.5C15.5 3.5 16 5 15.5 6.5" />
      <path d="M17 11l2-2 2 2-2 2-2-2z" />
    </svg>
  );
}

function HubIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <path d="M5.6 5.6c1.8 2.4 3 4.1 6.4 6.4-3.4 2.3-4.6 4-6.4 6.4" />
      <path d="M18.4 5.6c-1.8 2.4-3 4.1-6.4 6.4 3.4 2.3 4.6 4 6.4 6.4" />
    </svg>
  );
}

function isTabLocked(href: string, step: number): boolean {
  if (step === TUTORIAL_DONE) return false;
  if (href === '/') return false;
  if (href === '/lineup' && step >= 1) return false;
  if (href === '/profile' && step >= 2) return false;
  if (href === '/market'  && step >= 3) return false;
  if (href === '/league'  && step >= 4) return false;
  return true;
}

export function BottomTabBar() {
  const pathname = usePathname();
  const { language } = useContext(LanguageContext);
  const { step } = useTutorial();

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
    { name: 'HOME',      href: '/',        Icon: HomeIcon,      id: 'tab-home'      },
    { name: 'TEAM',      href: '/lineup',  Icon: TeamIcon,      id: 'tab-lineup'    },
    { name: 'TRANSFERS', href: '/market',  Icon: TransfersIcon, id: 'tab-market'    },
    { name: 'MANAGER',   href: '/profile', Icon: ManagerIcon,   id: 'tab-manager'   },
    { name: 'HUB',       href: '/league',  Icon: HubIcon,       id: 'tab-hub'       },
  ];

  // Hide on onboarding
  if (pathname === '/onboarding') return null;

  return (
    <div
      className="fixed bottom-0 w-full max-w-[480px] z-50 pb-safe"
      style={{
        background: 'rgba(5,6,15,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Top neon gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

      <div className="flex gap-0 px-1 py-1.5">
        {navItems.map(({ name, href, Icon, id }) => {
          const isActive = activeTab === href;
          const locked   = isTabLocked(href, step);

          if (locked) {
            return (
              <button
                key={href}
                id={id}
                aria-label={`${name} (locked)`}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-gray-700 transition-colors duration-200"
                onClick={() => toast(LOCKED_TOAST_MSG, {
                  icon: '🔒',
                  duration: 2000,
                  style: { background: '#05060f', color: '#fff', border: '1px solid rgba(0,240,255,0.2)' },
                })}
              >
                <div className="relative">
                  <Icon active={false} />
                  <motion.span
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500/80 flex items-center justify-center shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <Lock size={7} className="text-white" />
                  </motion.span>
                </div>
                <span className="text-[8px] uppercase font-bold tracking-wider opacity-25">{name}</span>
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              id={id}
              aria-label={name}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 relative transition-all duration-200 active:scale-90"
            >
              {/* Active indicator — cyan line above icon */}
              {isActive && (
                <motion.div
                  layoutId="tab-active-bar"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #00f0ff, transparent)',
                    boxShadow: '0 0 8px rgba(0,240,255,0.8)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icon */}
              <div className={`relative mt-1 transition-all duration-200 ${
                isActive
                  ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]'
                  : 'text-gray-600 hover:text-gray-400'
              }`}>
                <Icon active={isActive} />
              </div>

              {/* Label */}
              <span className={`text-[7px] uppercase font-black tracking-wider transition-colors duration-200 ${
                isActive ? 'text-cyan-400' : 'text-gray-700'
              }`}>
                {name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
