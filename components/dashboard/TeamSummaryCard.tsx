'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Shield } from 'lucide-react';

interface Props {
  teamOvr: number;
  tactic: string;
  avgStamina: number;
  injuredCount: number;
  language?: string;
}

export function TeamSummaryCard({ teamOvr, tactic, avgStamina, injuredCount, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  const getHealthStyle = (count: number) => {
    if (count === 0) return { text: 'text-emerald-300', glow: '0 0 8px rgba(52,211,153,0.4)' };
    if (count <= 2) return { text: 'text-amber-300', glow: '0 0 8px rgba(245,158,11,0.3)' };
    return { text: 'text-red-400', glow: '0 0 8px rgba(239,68,68,0.4)' };
  };

  const health = getHealthStyle(injuredCount);

  return (
    <div className="h-full w-full rounded-2xl border border-white/10 p-3 flex flex-col justify-between gap-2 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/8"
         style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
      {/* Glass highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-2xl" />
      
      <div className="flex items-center gap-1.5">
        <Shield size={12} className="text-cyan-400" />
        <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{t.team_status || 'TEAM'}</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-1">
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider truncate">{t.stat_ovr || 'OVR'}</span>
          <span className="text-lg font-black font-orbitron text-white leading-none" style={{ textShadow: '0 0 10px rgba(0,240,255,0.3)' }}>{teamOvr}</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider truncate">{t.lineup_tactic || 'Tactic'}</span>
          <span className="text-[10px] font-bold text-cyan-300 uppercase truncate mt-1">{tactic}</span>
        </div>
        <div className="col-span-2 flex justify-between items-center bg-white/5 rounded-lg pl-1.5 pr-2 py-1 border border-white/5">
          <span className="text-[8px] text-gray-500 uppercase tracking-wider truncate pr-2">{t.injured_players || 'Injured'}</span>
          <span className={`text-sm font-black ${health.text}`} style={{ textShadow: health.glow }}>{injuredCount}</span>
        </div>
      </div>
    </div>
  );
}
