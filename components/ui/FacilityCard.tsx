'use client';

import { motion } from 'framer-motion';
import { ChevronUp, Lock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// FacilityCard — Large card for STRUCTURES page (Training, Club, Stadium).
//
// Shows: header accent, facility name, level badge, description,
//        level benefits, integrity progress bar, upgrade button.
// ─────────────────────────────────────────────────────────────────────────────

export interface FacilityData {
  key: string;
  label: string;
  description: string;
  levelBenefits: string;
  nextLevelBenefits?: string;
  level: number;
  maxLevel?: number;
  integrityPct?: number; // 0-100
  upgradeCost?: number;
  canAfford?: boolean;
  isMaxed?: boolean;
  accentColor: 'cyan' | 'violet' | 'emerald' | 'yellow' | 'rose' | 'teal' | 'orange' | 'pink';
  Icon: React.ElementType;
}

const ACCENT = {
  cyan:    { bg: 'from-cyan-900/20',    border: 'border-cyan-800/40',    hover: 'hover:border-cyan-500/50',    text: 'text-cyan-400',    bar: 'bg-cyan-400',    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.1)]'    },
  violet:  { bg: 'from-violet-900/20',  border: 'border-violet-800/40',  hover: 'hover:border-violet-500/50',  text: 'text-violet-400',  bar: 'bg-violet-400',  glow: 'shadow-[0_0_20px_rgba(147,51,234,0.1)]'  },
  emerald: { bg: 'from-emerald-900/20', border: 'border-emerald-800/40', hover: 'hover:border-emerald-500/50', text: 'text-emerald-400', bar: 'bg-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.1)]'  },
  yellow:  { bg: 'from-yellow-900/20',  border: 'border-yellow-800/40',  hover: 'hover:border-yellow-500/50',  text: 'text-yellow-400',  bar: 'bg-yellow-400',  glow: 'shadow-[0_0_20px_rgba(234,179,8,0.1)]'   },
  rose:    { bg: 'from-rose-900/20',    border: 'border-rose-800/40',    hover: 'hover:border-rose-500/50',    text: 'text-rose-400',    bar: 'bg-rose-400',    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.1)]'   },
  teal:    { bg: 'from-teal-900/20',    border: 'border-teal-800/40',    hover: 'hover:border-teal-500/50',    text: 'text-teal-400',    bar: 'bg-teal-400',    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.1)]'  },
  orange:  { bg: 'from-orange-900/20',  border: 'border-orange-800/40',  hover: 'hover:border-orange-500/50',  text: 'text-orange-400',  bar: 'bg-orange-400',  glow: 'shadow-[0_0_20px_rgba(249,115,22,0.1)]'  },
  pink:    { bg: 'from-pink-900/20',    border: 'border-pink-800/40',    hover: 'hover:border-pink-500/50',    text: 'text-pink-400',    bar: 'bg-pink-400',    glow: 'shadow-[0_0_20px_rgba(236,72,153,0.1)]'  },
};

interface FacilityCardProps {
  facility: FacilityData;
  isPending?: boolean;
  onUpgrade?: (key: string) => void;
}

export function FacilityCard({ facility: f, isPending = false, onUpgrade }: FacilityCardProps) {
  const a         = ACCENT[f.accentColor];
  const maxLevel  = f.maxLevel ?? 10;
  const integrity = f.integrityPct ?? 100;
  const isMaxed   = f.isMaxed ?? f.level >= maxLevel;
  const Icon      = f.Icon;

  return (
    <motion.div
      className={`
        relative overflow-hidden rounded-2xl border
        bg-gradient-to-br ${a.bg} to-black/60
        ${a.border} ${a.hover} ${a.glow}
        transition-all duration-300
        ${isMaxed ? 'border-yellow-500/40' : ''}
      `}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Ambient glow blob */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-40"
           style={{ background: `var(--neon-${f.accentColor === 'cyan' ? 'cyan' : 'violet'}, rgba(0,240,255,0.05))` }} />

      <div className="relative z-10 p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon box */}
          <div className={`
            w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center
            border bg-black/40
            ${a.border}
          `}>
            <Icon className={a.text} size={22} />
          </div>

          {/* Name + level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-black font-orbitron text-white uppercase tracking-wide leading-none">
                {f.label}
              </h3>
              <span className={`
                text-[8px] font-black px-1.5 py-0.5 rounded-md border
                ${isMaxed
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                  : `bg-black/40 ${a.text} ${a.border}`
                }
              `}>
                {isMaxed ? '★ MAX' : `LVL ${f.level}`}
              </span>
            </div>
            <p className="text-[9px] text-gray-500 leading-snug">{f.description}</p>
          </div>

          {/* Upgrade button */}
          {onUpgrade && (
            <button
              onClick={() => onUpgrade(f.key)}
              disabled={isPending || !f.canAfford || isMaxed}
              className={`
                flex-shrink-0 flex flex-col items-center justify-center
                px-3 py-2 rounded-xl border
                text-[8px] font-black font-orbitron uppercase tracking-wider
                min-w-[56px] transition-all duration-200
                ${isPending
                  ? 'bg-gray-800/60 text-gray-500 border-gray-700/30 cursor-wait'
                  : isMaxed
                  ? 'bg-yellow-900/20 text-yellow-600 border-yellow-700/30 cursor-default'
                  : !f.canAfford
                  ? 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed'
                  : `bg-black/40 ${a.text} ${a.border} hover:brightness-125 active:scale-95`
                }
              `}
            >
              {isPending ? (
                <span className="animate-pulse">...</span>
              ) : isMaxed ? (
                <span>★</span>
              ) : (
                <>
                  <ChevronUp size={12} />
                  <span className="text-[7px] font-mono opacity-75 mt-0.5">
                    {f.upgradeCost?.toLocaleString() ?? '—'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Benefits */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-black/30 rounded-lg px-2.5 py-1.5 border border-white/5">
            <div className="text-[7px] text-gray-600 uppercase tracking-widest mb-0.5 font-bold">Current</div>
            <div className={`text-[9px] font-bold ${a.text}`}>{f.levelBenefits}</div>
          </div>
          {f.nextLevelBenefits && !isMaxed && (
            <div className="flex-1 bg-black/30 rounded-lg px-2.5 py-1.5 border border-white/5">
              <div className="text-[7px] text-gray-600 uppercase tracking-widest mb-0.5 font-bold">Next</div>
              <div className="text-[9px] font-bold text-gray-400">{f.nextLevelBenefits}</div>
            </div>
          )}
        </div>

        {/* Integrity bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-gray-600 uppercase tracking-wider font-bold">Integrity</span>
            <span className={`text-[9px] font-bold font-mono ${
              integrity > 60 ? 'text-emerald-400' : integrity > 30 ? 'text-yellow-400' : 'text-red-400'
            }`}>{integrity}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                integrity > 60 ? 'bg-emerald-400' : integrity > 30 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${integrity}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Level progress segments */}
        <div className="flex gap-0.5 mt-2">
          {Array.from({ length: maxLevel }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i < f.level
                  ? isMaxed ? 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.6)]' : a.bar
                  : 'bg-white/5'
              }`}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          ))}
        </div>

        {/* Insufficient funds hint */}
        {!f.canAfford && !isMaxed && !isPending && f.upgradeCost !== undefined && (
          <p className="text-[8px] text-gray-700 font-mono mt-1.5">
            Need {((f.upgradeCost ?? 0) - 0).toLocaleString()} more FC
          </p>
        )}
      </div>

      {/* Max level golden glow overlay */}
      {isMaxed && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
             style={{ boxShadow: 'inset 0 0 30px rgba(234,179,8,0.06)' }} />
      )}
    </motion.div>
  );
}
