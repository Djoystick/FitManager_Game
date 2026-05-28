'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Building2, Droplets, ShoppingCart, Trophy } from 'lucide-react';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

export function BottomTabBar() {
  const pathname = usePathname();
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const navItems = [
    { name: t.nav_home,   href: '/',        icon: Home         },
    { name: t.nav_squad,  href: '/lineup',  icon: Users        },
    { name: 'База',       href: '/base',    icon: Building2    },
    { name: 'Банк',       href: '/bank',    icon: Droplets     },
    { name: 'Рынок',      href: '/market',  icon: ShoppingCart },
    { name: t.nav_league, href: '/league',  icon: Trophy       },
  ];

  return (
    <div className="fixed bottom-0 w-full max-w-[480px] z-50 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 pb-safe">
      {/* Horizontal scrollable tabs — 6 items, no truncation */}
      <div className="flex overflow-x-auto scrollbar-none gap-0 px-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`tab-${item.href.replace('/', '') || 'home'}`}
              className={`
                flex-shrink-0 flex flex-col items-center justify-center
                w-[16.666%] min-w-[56px] gap-0.5 transition-colors duration-200
                ${isActive
                  ? 'text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]'
                  : 'text-gray-500 hover:text-gray-300 active:text-gray-200'
                }
              `}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-cyan" />
                )}
              </div>
              <span className={`text-[9px] uppercase font-bold tracking-wider ${isActive ? 'text-neon-cyan' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
