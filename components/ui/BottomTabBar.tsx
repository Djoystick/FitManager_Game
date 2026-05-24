'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Hospital, Trophy, ShoppingCart } from 'lucide-react';

export function BottomTabBar() {
  const pathname = usePathname();

  // Exclude routes where tab bar shouldn't be visible if necessary, like Auth or Admin
  // For now, it will be visible globally as per request.

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Squad', href: '/lineup', icon: Users },
    { name: 'Base', href: '/base', icon: Hospital },
    { name: 'League', href: '/league', icon: Trophy },
    { name: 'Market', href: '/market', icon: ShoppingCart },
  ];

  return (
    <div className="fixed bottom-0 w-full max-w-[480px] z-50 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 pb-safe">
      <div className="flex justify-between items-center px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full gap-1 transition-colors ${
                isActive 
                  ? 'text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className="relative">
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-cyan"></span>
                )}
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? 'text-neon-cyan' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
