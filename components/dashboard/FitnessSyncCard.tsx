'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Activity, Dumbbell } from 'lucide-react';

interface Props {
  avgStamina?: number;
  language?: string;
}

export function FitnessSyncCard({ avgStamina = 70, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  const staminaColor = avgStamina >= 70 ? 'text-neon-green' : avgStamina >= 40 ? 'text-yellow-400' : 'text-red-400';
  const barColor = avgStamina >= 70 ? 'bg-neon-green' : avgStamina >= 40 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="w-full h-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-col justify-center gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Dumbbell size={12} className="text-emerald-400" />
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{t.fitness_center_tab || 'FITNESS'}</span>
        </div>
        <span className={`text-[10px] font-black font-orbitron ${staminaColor}`}>{avgStamina}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, avgStamina)}%` }} />
      </div>
    </div>
  );
}
