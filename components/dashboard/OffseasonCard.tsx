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

      if (diff <= 0) {
        setIsStarted(true);
        setTimeLeft({ h: 0, m: 0, s: 0 });
        return;
      }

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

  let statusColor = "text-cyan-400";
  let statusBg = "bg-cyan-500/10";
  let statusBorder = "border-cyan-500/30";
  let statusShadow = "shadow-[0_0_20px_rgba(6,182,212,0.15)]";
  let Icon = MinusCircle;
  let statusText = t.season_ended || 'SEASON ENDED';

  if (lastSeasonResult) {
    if (lastSeasonResult.isChampion) {
      statusColor = "text-yellow-400";
      statusBg = "bg-yellow-500/10";
      statusBorder = "border-yellow-500/50";
      statusShadow = "shadow-[0_0_30px_rgba(234,179,8,0.2)]";
      Icon = Trophy;
      statusText = t.season_champion || 'CHAMPION!';
    } else if (lastSeasonResult.isPromoted) {
      statusColor = "text-green-400";
      statusBg = "bg-green-500/10";
      statusBorder = "border-green-500/50";
      statusShadow = "shadow-[0_0_30px_rgba(34,197,94,0.2)]";
      Icon = ArrowUpCircle;
      statusText = t.season_promoted || 'PROMOTED';
    } else if (lastSeasonResult.isRelegated) {
      statusColor = "text-red-400";
      statusBg = "bg-red-500/10";
      statusBorder = "border-red-500/50";
      statusShadow = "shadow-[0_0_30px_rgba(239,68,68,0.2)]";
      Icon = ArrowDownCircle;
      statusText = t.season_relegated || 'RELEGATED';
    }
  }

  const hours = timeLeft.h.toString().padStart(2, '0');
  const mins = timeLeft.m.toString().padStart(2, '0');
  const secs = timeLeft.s.toString().padStart(2, '0');

  return (
    <div className={`bg-black/40 backdrop-blur-md border ${statusBorder} rounded-2xl p-4 flex flex-col gap-3 ${statusShadow} relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-32 h-32 ${statusBg} rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none`}></div>
      
      <div className="flex items-center justify-between relative z-10">
        <div className={`flex items-center gap-2 ${statusColor}`}>
          <Icon className="w-5 h-5 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{statusText}</span>
        </div>
        {lastSeasonResult && (
          <span className="text-xl font-black text-white font-orbitron drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
            #{lastSeasonResult.rank}
          </span>
        )}
      </div>

      {lastSeasonResult && (
        <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-widest relative z-10 mb-1">
          <span>{t.season_prev_league || 'Previous League'}: Tier {lastSeasonResult.tierLevel}</span>
          <span>{lastSeasonResult.points} {t.season_pts || 'PTS'}</span>
        </div>
      )}

      <div className="w-full h-[1px] bg-gray-800 relative z-10"></div>

      <div className="flex justify-between items-center mt-1 relative z-10">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock className="w-3.5 h-3.5" />
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
