'use client';

import { useState, useEffect } from 'react';
import { Trophy, ArrowUpCircle, ArrowDownCircle, MinusCircle, Clock } from 'lucide-react';
import { dict } from '@/lib/dictionaries';

interface Props {
  lastSeasonResult: {
    rank: number;
    tierLevel: number;
    isChampion: boolean;
    isPromoted: boolean;
    isRelegated: boolean;
    points: number;
  } | null;
  instanceCreatedAt: string | null;
  language?: string;
}

export function OffseasonCard({ lastSeasonResult, instanceCreatedAt, language = 'ru' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    if (!instanceCreatedAt) return;
    const targetTime = new Date(instanceCreatedAt).getTime() + 24 * 60 * 60 * 1000;
    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetTime - now;
      if (diff <= 0) { setIsStarted(true); setTimeLeft({ h: 0, m: 0, s: 0 }); return; }
      setTimeLeft({
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [instanceCreatedAt]);

  let statusColor = "text-cyan-300";
  let Icon = MinusCircle;
  let statusText = t.season_ended || 'SEASON ENDED';
  let gradientFrom = 'rgba(0,240,255,0.06)';

  if (lastSeasonResult) {
    if (lastSeasonResult.isChampion) {
      statusColor = "text-amber-300"; Icon = Trophy; statusText = t.season_champion || 'CHAMPION!';
      gradientFrom = 'rgba(245,158,11,0.08)';
    } else if (lastSeasonResult.isPromoted) {
      statusColor = "text-emerald-300"; Icon = ArrowUpCircle; statusText = t.season_promoted || 'PROMOTED';
      gradientFrom = 'rgba(52,211,153,0.08)';
    } else if (lastSeasonResult.isRelegated) {
      statusColor = "text-red-400"; Icon = ArrowDownCircle; statusText = t.season_relegated || 'RELEGATED';
      gradientFrom = 'rgba(239,68,68,0.06)';
    }
  }

  const hours = timeLeft.h.toString().padStart(2, '0');
  const mins = timeLeft.m.toString().padStart(2, '0');
  const secs = timeLeft.s.toString().padStart(2, '0');

  return (
    <div className="relative overflow-hidden p-4 rounded-2xl border border-white/10 backdrop-blur-xl flex flex-col gap-2.5"
         style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, rgba(255,255,255,0.02) 100%)` }}>
      {/* Glass highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-2xl" />
      {/* Ambient glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none ${lastSeasonResult?.isChampion ? 'bg-amber-500/10' : lastSeasonResult?.isPromoted ? 'bg-emerald-500/10' : 'bg-cyan-500/8'}`} />

      <div className="flex items-center justify-between relative z-10">
        <div className={`flex items-center gap-2 ${statusColor}`}>
          <Icon className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{statusText}</span>
        </div>
        {lastSeasonResult && (
          <span className="text-xl font-black text-white font-orbitron" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
            #{lastSeasonResult.rank}
          </span>
        )}
      </div>

      {lastSeasonResult && (
        <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest relative z-10">
          <span>{t.season_prev_league || 'Previous League'}: Tier {lastSeasonResult.tierLevel}</span>
          <span>{lastSeasonResult.points} {t.season_pts || 'PTS'}</span>
        </div>
      )}

      <div className="w-full h-px bg-white/5 relative z-10" />

      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="w-3 h-3" />
          <span className="text-[9px] uppercase tracking-widest">{isStarted ? (t.season_started || 'Season started') : (t.season_transfer_window || 'TRANSFER WINDOW')}</span>
        </div>
        {!isStarted && (
          <span className={`text-xs font-bold ${statusColor} font-mono tracking-wider`}>
            {hours}:{mins}:{secs}
          </span>
        )}
      </div>
    </div>
  );
}
