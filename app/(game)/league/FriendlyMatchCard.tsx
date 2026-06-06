'use client';

import React, { useState } from 'react';
import { Swords, Gift, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FriendlyMatchCardProps {
  userId: string;
  initialMatchesPlayed: number;
}

export function FriendlyMatchCard({ userId, initialMatchesPlayed }: FriendlyMatchCardProps) {
  const [matchesPlayed, setMatchesPlayed] = useState(initialMatchesPlayed);
  const [isLoading, setIsLoading] = useState(false);
  const maxMatches = 5;

  const playMatch = async () => {
    if (matchesPlayed >= maxMatches) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/league/friendly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      
      if (data.success) {
        setMatchesPlayed(data.matchesPlayed);
        if (data.result === 'win') {
          toast.success(`Победа ${data.score.home}:${data.score.away}! Вы получили ${data.rewards.fc} FC и ${data.rewards.sp} SP`, { duration: 4000 });
        } else if (data.result === 'draw') {
          toast(`Ничья ${data.score.home}:${data.score.away}. Вы получили ${data.rewards.fc} FC и ${data.rewards.sp} SP`, { icon: '🤝', duration: 4000 });
        } else {
          toast.error(`Поражение ${data.score.home}:${data.score.away}. Вы получили ${data.rewards.fc} FC и ${data.rewards.sp} SP`, { duration: 4000 });
        }
      } else {
        toast.error(data.error || 'Ошибка при симуляции матча');
      }
    } catch (err) {
      toast.error('Сетевая ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card-cyan relative overflow-hidden p-4 mb-4 mt-1 border border-cyan-500/30">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
            <Swords className="text-cyan-400" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black font-orbitron text-white">Товарищеский Матч</h3>
            <p className="text-[10px] text-cyan-400/80 uppercase tracking-widest">Ознакомление</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Доступно</span>
          <div className="text-sm font-black text-cyan-300 font-mono">
            {maxMatches - matchesPlayed} / {maxMatches}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-300 leading-relaxed mb-4">
        Сыграйте разминочный матч против ИИ, пока идет трансферное окно. За победу вы получите стартовые ресурсы для прокачки команды!
      </p>

      {matchesPlayed >= maxMatches ? (
        <button disabled className="w-full py-3 rounded-xl bg-black/40 border border-gray-700/50 text-gray-500 text-[11px] font-black uppercase tracking-widest">
          Лимит исчерпан
        </button>
      ) : (
        <button
          onClick={playMatch}
          disabled={isLoading}
          className={`w-full relative overflow-hidden py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
            isLoading ? 'bg-cyan-900/50 text-cyan-500' : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              <span className="text-[11px] font-black uppercase tracking-widest">Играем...</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-black uppercase tracking-widest">Сыграть Матч</span>
              <Gift size={14} className="opacity-80" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
