'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PlayerListRow — Compact horizontal player row for squad/transfer lists.
//
// Displays: Role pill (position-colored), Name, Age, Rating pill.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerRowData {
  id: string;
  name: string;
  age: number;
  ovr: number;
  position: string;
  stamina?: number;
  is_injured?: boolean;
  market_value?: number;
}

// Position → color mapping
const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GK:  { bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/40' },
  CB:  { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40'   },
  CD:  { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40'   },
  LB:  { bg: 'bg-teal-500/20',    text: 'text-teal-300',    border: 'border-teal-500/40'   },
  RB:  { bg: 'bg-teal-500/20',    text: 'text-teal-300',    border: 'border-teal-500/40'   },
  LWB: { bg: 'bg-teal-500/20',    text: 'text-teal-300',    border: 'border-teal-500/40'   },
  RWB: { bg: 'bg-teal-500/20',    text: 'text-teal-300',    border: 'border-teal-500/40'   },
  CDM: { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/40' },
  CM:  { bg: 'bg-yellow-500/20',  text: 'text-yellow-300',  border: 'border-yellow-500/40' },
  CAM: { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/40'  },
  RM:  { bg: 'bg-yellow-500/20',  text: 'text-yellow-300',  border: 'border-yellow-500/40' },
  LM:  { bg: 'bg-yellow-500/20',  text: 'text-yellow-300',  border: 'border-yellow-500/40' },
  ST:  { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/40'    },
  CF:  { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/40'    },
  LWF: { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/40'   },
  RWF: { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/40'   },
};

const DEFAULT_POS_STYLE = { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/40' };

function ovrColor(ovr: number) {
  if (ovr >= 80) return 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';
  if (ovr >= 70) return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10';
  if (ovr >= 60) return 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10';
  return 'text-gray-400 border-gray-600/40 bg-gray-500/10';
}

interface PlayerListRowProps {
  player: PlayerRowData;
  onClick?: (player: PlayerRowData) => void;
  /** Show market value instead of age */
  showValue?: boolean;
  /** Extra right-side slot */
  rightSlot?: React.ReactNode;
  isSelected?: boolean;
}

export function PlayerListRow({
  player,
  onClick,
  showValue = false,
  rightSlot,
  isSelected = false,
}: PlayerListRowProps) {
  const posStyle = POSITION_COLORS[player.position] ?? DEFAULT_POS_STYLE;

  return (
    <div
      onClick={() => onClick?.(player)}
      className={`
        flex items-center gap-3 px-3 py-2.5
        border-b border-white/[0.05] last:border-b-0
        transition-all duration-150
        ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
        ${isSelected ? 'bg-cyan-500/8 border-l-2 border-l-cyan-500' : 'hover:bg-white/[0.025]'}
      `}
    >
      {/* Position pill */}
      <span className={`
        flex-shrink-0 text-[9px] font-black uppercase tracking-wider
        px-1.5 py-0.5 rounded-full border
        ${posStyle.bg} ${posStyle.text} ${posStyle.border}
        min-w-[30px] text-center
      `}>
        {player.position}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-white truncate block uppercase tracking-wide">
          {player.name}
        </span>
        {player.is_injured && (
          <span className="text-[9px] text-red-400 font-bold">🚑 Injured</span>
        )}
      </div>

      {/* Age or value */}
      <span className="text-[10px] text-gray-500 font-mono flex-shrink-0 w-8 text-center">
        {showValue && player.market_value !== undefined
          ? `${Math.round(player.market_value / 1000)}k`
          : `${player.age}`
        }
      </span>

      {/* OVR rating pill */}
      <span className={`
        flex-shrink-0 text-[10px] font-black font-orbitron
        px-2 py-0.5 rounded-full border
        ${ovrColor(player.ovr)}
      `}>
        {player.ovr}
      </span>

      {/* Optional right slot */}
      {rightSlot}
    </div>
  );
}
