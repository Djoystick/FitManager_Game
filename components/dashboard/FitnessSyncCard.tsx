'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Dumbbell } from 'lucide-react';

interface Props {
  avgStamina?: number;
  language?: string;
}

export function FitnessSyncCard({ avgStamina = 70, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  const getStaminaStyle = (val: number) => {
    if (val >= 70) return { text: 'text-emerald-300', bar: 'bg-emerald-400', glow: '0 0 10px rgba(52,211,153,0.4)' };
    if (val >= 40) return { text: 'text-amber-300', bar: 'bg-amber-400', glow: '0 0 8px rgba(245,158,11,0.3)' };
    return { text: 'text-red-400', bar: 'bg-red-400', glow: '0 0 8px rgba(239,68,68,0.4)' };
  };

  const style = getStaminaStyle(avgStamina);

  return (
    <div className="w-full h-full rounded-2xl border border-emerald-500/20 p-3 flex flex-col justify-center gap-2 backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/40"
         style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent rounded-2xl" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Dumbbell size={12} className="text-emerald-400" />
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{t.fitness_center_tab || 'FITNESS'}</span>
        </div>
        <span className={`text-[10px] font-black font-orbitron ${style.text}`} style={{ textShadow: style.glow }}>{avgStamina}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full rounded-full ${style.bar} transition-all duration-500`} style={{ width: `${Math.min(100, avgStamina)}%`, boxShadow: style.glow }} />
      </div>
    </div>
  );
}
