'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Eye } from 'lucide-react';

interface Props {
  count: number;
  onClick?: () => void;
  language?: string;
}

export function UnseenMatchesCard({ count, onClick, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border p-3 flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
        count > 0
          ? 'border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/15'
          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      {count > 0 && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center">
          <span className="text-[8px] font-black text-black">{count > 9 ? '9+' : count}</span>
        </div>
      )}
      <Eye size={16} className={count > 0 ? 'text-cyan-400' : 'text-gray-600'} />
      <span className={`text-[8px] font-black uppercase tracking-widest ${count > 0 ? 'text-cyan-300' : 'text-gray-600'}`}>
        {t.unseen_accept_single || 'Matches'}
      </span>
    </button>
  );
}
