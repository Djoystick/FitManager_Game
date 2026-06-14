'use client';

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — Premium Glassmorphism metric display card
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
  cyan:    { 
    bg: 'from-cyan-500/8 to-cyan-500/3', 
    border: 'border-cyan-500/25',   
    text: 'text-cyan-300',    
    glow: 'shadow-[0_0_20px_rgba(0,240,255,0.12)]',
    textGlow: '0 0 15px rgba(0,240,255,0.5)',
  },
  violet:  { 
    bg: 'from-violet-500/8 to-violet-500/3',  
    border: 'border-violet-500/25', 
    text: 'text-violet-300',  
    glow: 'shadow-[0_0_20px_rgba(147,51,234,0.12)]',
    textGlow: '0 0 15px rgba(147,51,234,0.5)',
  },
  emerald: { 
    bg: 'from-emerald-500/8 to-emerald-500/3', 
    border: 'border-emerald-500/25',
    text: 'text-emerald-300', 
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.12)]',
    textGlow: '0 0 15px rgba(52,211,153,0.5)',
  },
  yellow:  { 
    bg: 'from-amber-500/8 to-amber-500/3',  
    border: 'border-amber-500/25', 
    text: 'text-amber-300',  
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.12)]',
    textGlow: '0 0 15px rgba(245,158,11,0.5)',
  },
  red:     { 
    bg: 'from-red-500/8 to-red-500/3',     
    border: 'border-red-500/25',    
    text: 'text-red-300',     
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.12)]',
    textGlow: '0 0 15px rgba(239,68,68,0.5)',
  },
};

export function StatCard({ label, value, subLabel, accent = 'cyan', icon, className = '', onClick }: StatCardProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        rounded-2xl border p-3 text-center backdrop-blur-xl
        bg-gradient-to-br ${s.bg} ${s.border} ${s.glow}
        ${onClick ? 'cursor-pointer active:scale-95 transition-all duration-300' : ''}
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
      }}
    >
      {/* Top glass highlight */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {icon && <div className="mb-0.5 opacity-70">{icon}</div>}

      <span className="text-[8px] text-gray-500 uppercase tracking-[0.2em] font-bold">
        {label}
      </span>
      <span 
        className={`text-xl font-black font-orbitron leading-none ${s.text}`}
        style={{ textShadow: s.textGlow }}
      >
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
