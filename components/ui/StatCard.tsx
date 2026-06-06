'use client';

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — Small metric display card used in TEAM INFO grid.
// Shows a label + value with optional neon accent color.
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  accent?: 'cyan' | 'violet' | 'emerald' | 'yellow' | 'red';
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const ACCENT_STYLES = {
  cyan:    { bg: 'bg-cyan-500/8',    border: 'border-cyan-500/25',   text: 'text-cyan-300',    glow: 'shadow-[0_0_15px_rgba(0,240,255,0.1)]' },
  violet:  { bg: 'bg-violet-500/8',  border: 'border-violet-500/25', text: 'text-violet-300',  glow: 'shadow-[0_0_15px_rgba(147,51,234,0.1)]' },
  emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/25',text: 'text-emerald-300', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.1)]' },
  yellow:  { bg: 'bg-yellow-500/8',  border: 'border-yellow-500/25', text: 'text-yellow-300',  glow: 'shadow-[0_0_15px_rgba(234,179,8,0.1)]'  },
  red:     { bg: 'bg-red-500/8',     border: 'border-red-500/25',    text: 'text-red-300',     glow: 'shadow-[0_0_15px_rgba(239,68,68,0.1)]'  },
};

export function StatCard({ label, value, subLabel, accent = 'cyan', icon, className = '', onClick }: StatCardProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        rounded-2xl border p-3 text-center
        ${s.bg} ${s.border} ${s.glow}
        ${onClick ? 'cursor-pointer active:scale-95 transition-transform duration-150' : ''}
        ${className}
      `}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {icon && <div className="mb-0.5 opacity-70">{icon}</div>}

      <span className="text-[8px] text-gray-500 uppercase tracking-[0.2em] font-bold">
        {label}
      </span>
      <span className={`text-lg font-black font-orbitron leading-none ${s.text}`}>
        {value}
      </span>
      {subLabel && (
        <span className="text-[8px] text-gray-600 uppercase tracking-wider font-bold mt-0.5">
          {subLabel}
        </span>
      )}
    </div>
  );
}
