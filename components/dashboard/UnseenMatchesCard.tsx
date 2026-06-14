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
    <button onClick={onClick}
            className={`relative w-full h-full overflow-hidden rounded-2xl border p-3 flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 backdrop-blur-xl ${
              count > 0
                ? 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-white/8'
                : 'border-white/10 hover:bg-white/8 hover:border-white/20'
            }`}
            style={{ background: count > 0 ? 'linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
      {/* Glass highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-2xl" />
      
      {count > 0 && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center"
             style={{ boxShadow: '0 0 8px rgba(0,240,255,0.5)' }}>
          <span className="text-[8px] font-black text-[#0a0a0f]">{count > 9 ? '9+' : count}</span>
        </div>
      )}
      <Eye size={16} className={count > 0 ? 'text-cyan-400' : 'text-gray-600'} />
      <span className={`text-[8px] font-black uppercase tracking-widest ${count > 0 ? 'text-cyan-300' : 'text-gray-600'}`}>
        {t.dashboard_new_matches || 'NEW MATCHES'}
      </span>
    </button>
  );
}
