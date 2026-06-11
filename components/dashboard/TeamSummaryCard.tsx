'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Shield, Zap, Heart } from 'lucide-react';

interface Props {
  teamOvr: number;
  tactic: string;
  avgStamina: number;
  injuredCount: number;
  language?: string;
}

export function TeamSummaryCard({ teamOvr, tactic, avgStamina, injuredCount, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  const healthColor = injuredCount === 0 ? 'text-neon-green' : injuredCount <= 2 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Shield size={12} className="text-cyan-400" />
        <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{t.team_status || 'TEAM'}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider">{t.stat_ovr || 'OVR'}</span>
          <span className="text-lg font-black font-orbitron text-white leading-none">{teamOvr}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider">{t.lineup_tactic || 'Tactic'}</span>
          <span className="text-[9px] font-bold text-cyan-300 uppercase">{tactic}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider">{t.injured_players || 'Injured'}</span>
          <span className={`text-sm font-black ${healthColor}`}>{injuredCount}</span>
        </div>
      </div>
    </div>
  );
}
