'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Swords, ChevronRight } from 'lucide-react';

interface Props {
  opponentName: string | null;
  opponentLogoUrl?: string | null;
  roundNumber?: number;
  opponentId?: string | null;
  onScout?: () => void;
  language?: string;
}

export function NextMatchInfoCard({ opponentName, opponentLogoUrl, roundNumber, onScout, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  if (!opponentName) {
    return (
      <div className="glass-card p-3 rounded-xl flex-shrink-0 flex items-center justify-center">
        <span className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">{t.no_upcoming || 'No upcoming fixtures'}</span>
      </div>
    );
  }

  return (
    <div
      className="glass-card p-3 rounded-xl flex-shrink-0 cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onScout}
    >
      {/* Top row: label + round */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Swords size={10} className="text-cyan-400" />
          <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">{t.next_fixture || 'Next Match'}</span>
        </div>
        {roundNumber && (
          <span className="text-[8px] text-gray-600 font-mono">{t.match_round?.replace('{round}', String(roundNumber)) || `R${roundNumber}`}</span>
        )}
      </div>

      {/* Middle: opponent info */}
      <div className="flex items-center gap-2.5">
        {opponentLogoUrl ? (
          <img src={opponentLogoUrl} alt={opponentName} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-gray-500">
            {opponentName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-black text-white truncate block">{t.match_vs || 'vs'} {opponentName}</span>
        </div>
        <span className="text-[8px] text-cyan-400/40 uppercase tracking-wider flex items-center gap-0.5">
          {t.scout_btn || 'Scout'} <ChevronRight size={10} />
        </span>
      </div>
    </div>
  );
}
