'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { dict } from '@/lib/dictionaries';

interface Props {
  nextMatchTime?: string;
  language?: string;
}

export function NextMatchCountdown({ nextMatchTime, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict];
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [targetHour, setTargetHour] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = new Date();
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);

      const diff = nextHour.getTime() - now.getTime();
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setMinutesLeft(m);
      setSecondsLeft(s);
      setTargetHour(`${nextHour.getHours().toString().padStart(2, '0')}:00`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const progressPct = ((60 - minutesLeft) / 60) * 100;

  return (
    <div className="bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 flex flex-col gap-2 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t.next_fixture || 'NEXT FIXTURE'}</span>
        </div>
        <span className="text-sm font-black text-white font-orbitron drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">
          {targetHour}
        </span>
      </div>

      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1 relative">
        <div 
          className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-1000 ease-linear" 
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-1">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest">{t.simulating_in || 'Simulating in'}</span>
        <span className="text-[10px] font-bold text-cyan-300 font-mono">
          {minutesLeft.toString().padStart(2, '0')}:{secondsLeft.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
