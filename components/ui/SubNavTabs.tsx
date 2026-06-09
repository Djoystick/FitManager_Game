'use client';

import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// SubNavTabs — Reusable pill-tab sub-navigation component.
//
// Usage:
//   <SubNavTabs
//     tabs={[{ id: 'info', label: 'INFO' }, { id: 'players', label: 'PLAYERS' }]}
//     active="info"
//     onChange={setActive}
//   />
//
// Design: Full-width pill row. Active pill: semi-opaque white with cyan glow.
//         Inactive pills: transparent gray text. Smooth slide indicator.
// ─────────────────────────────────────────────────────────────────────────────

export interface SubNavTab {
  id: string;
  label: string;
  badge?: string | number;
}

interface SubNavTabsProps {
  tabs: SubNavTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  /** Use 'cyan' (default) or 'violet' active accent */
  accent?: 'cyan' | 'violet' | 'emerald';
}

export function SubNavTabs({
  tabs,
  active,
  onChange,
  className = '',
  accent = 'cyan',
}: SubNavTabsProps) {
  const accentStyles = {
    cyan: {
      activeBg:     'bg-white/10',
      activeBorder: 'border-cyan-500/40',
      activeText:   'text-cyan-300',
      activeShadow: '0 0 12px rgba(0,240,255,0.25)',
      inactiveText: 'text-gray-500',
    },
    violet: {
      activeBg:     'bg-violet-500/15',
      activeBorder: 'border-violet-500/40',
      activeText:   'text-violet-300',
      activeShadow: '0 0 12px rgba(147,51,234,0.3)',
      inactiveText: 'text-gray-500',
    },
    emerald: {
      activeBg:     'bg-emerald-500/10',
      activeBorder: 'border-emerald-500/40',
      activeText:   'text-emerald-300',
      activeShadow: '0 0 12px rgba(52,211,153,0.25)',
      inactiveText: 'text-gray-500',
    },
  }[accent];

  return (
    <div className={`flex gap-1 px-3 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <motion.button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              relative flex-1 flex items-center justify-center gap-1.5
              py-2 px-2 rounded-full text-[10px] font-black uppercase tracking-wider
              border transition-colors duration-200
              ${isActive
                ? `${accentStyles.activeBg} ${accentStyles.activeBorder} ${accentStyles.activeText}`
                : `border-transparent ${accentStyles.inactiveText} hover:text-gray-300`
              }
            `}
            style={isActive ? { boxShadow: accentStyles.activeShadow } : undefined}
            whileTap={{ scale: 0.95 }}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`
                text-[8px] font-black px-1.5 py-0.5 rounded-full
                ${isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-gray-600'
                }
              `}>
                {tab.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
