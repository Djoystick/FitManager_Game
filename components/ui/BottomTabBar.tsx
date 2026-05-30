'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Building2, Droplets, ShoppingCart, Trophy, Lock } from 'lucide-react';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { useTutorial, TUTORIAL_DONE } from '@/components/providers/TutorialContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// BottomTabBar — 6-tab navigation with progressive tutorial locking.
//
// Lock rules:
//   tutorial step 0  → all tabs locked except Home
//   tutorial step 1  → lineup unlocked (user must visit squad)
//   tutorial step 2+ → lineup + base unlocked
//   tutorial DONE    → all tabs unlocked
//
// Locked tabs show a 🔒 badge and show a toast on click.
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_TOAST_MSG = '🎓 Сначала пройди обучение!';

function isTabLocked(href: string, step: number): boolean {
  if (step === TUTORIAL_DONE) return false;
  if (href === '/' || href === '') return false;      // Home always open
  if (href === '/lineup' && step >= 1) return false;  // Unlocked at step 1
  if (href === '/base'   && step >= 2) return false;  // Unlocked at step 2
  return true; // everything else locked during tutorial
}

export function BottomTabBar() {
  const pathname = usePathname();
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { step, isDone } = useTutorial();

  const navItems = [
    { name: t.nav_home,   href: '/',        icon: Home,         id: 'tab-home'   },
    { name: t.nav_squad,  href: '/lineup',  icon: Users,        id: 'tab-lineup' },
    { name: 'База',       href: '/base',    icon: Building2,    id: 'tab-base'   },
    { name: 'Банк',       href: '/bank',    icon: Droplets,     id: 'tab-bank'   },
    { name: 'Рынок',      href: '/market',  icon: ShoppingCart, id: 'tab-market' },
    { name: t.nav_league, href: '/league',  icon: Trophy,       id: 'tab-league' },
  ];

  // Hide entirely on onboarding screen
  if (pathname === '/onboarding') return null;

  return (
    <div className="fixed bottom-0 w-full max-w-[480px] z-50
                    bg-gray-950/90 backdrop-blur-xl border-t border-white/5
                    shadow-[0_-4px_30px_rgba(0,0,0,0.5)] pb-safe">

      {/* Active tab glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-cyan-500/30 to-transparent" />

      <div className="flex overflow-x-auto scrollbar-none gap-0 px-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const locked   = isTabLocked(item.href, step);
          const Icon     = item.icon;

          if (locked) {
            return (
              <button
                key={item.href}
                id={item.id}
                aria-label={`${item.name} (locked)`}
                className="flex-shrink-0 flex flex-col items-center justify-center
                           w-[16.666%] min-w-[56px] gap-0.5 relative
                           text-gray-700 active:text-gray-600 transition-colors duration-200"
                onClick={() =>
                  toast(LOCKED_TOAST_MSG, {
                    icon: '🔒',
                    duration: 2000,
                    style: { background: '#111', color: '#fff', border: '1px solid rgba(255,0,60,0.4)' },
                  })
                }
              >
                {/* Lock badge */}
                <div className="relative">
                  <Icon size={22} strokeWidth={1.5} className="opacity-30" />
                  <motion.span
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full
                               bg-red-500/80 flex items-center justify-center
                               shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <Lock size={7} className="text-white" />
                  </motion.span>
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-30">
                  {item.name}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              aria-label={item.name}
              className={`
                flex-shrink-0 flex flex-col items-center justify-center
                w-[16.666%] min-w-[56px] gap-0.5 transition-all duration-200
                active:scale-90
                ${isActive
                  ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]'
                  : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <motion.span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1
                               rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.8)]"
                    layoutId="active-dot"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-[9px] uppercase font-bold tracking-wider
                ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
