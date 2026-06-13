'use client';

import { useState, useEffect } from 'react';
import { Target, Gift, Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Quest {
  id: string;
  quest_type: string;
  target_value: number;
  current_value: number;
  is_claimed: boolean;
  reward_fc: number;
  reward_sp: number;
}

export function DailyQuestsWidget({ userId, language }: { userId: string, language: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuests = async () => {
      // 1. Trigger generation
      await fetch('/api/quests/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      // 2. Load quests
      const { supabase } = await import('@/lib/supabase');
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('daily_quests').select('*').eq('user_id', userId).eq('date', today).order('id');
      if (data) setQuests(data);
      setLoading(false);
    };
    fetchQuests();
  }, [userId]);

  const handleClaim = async (q: Quest) => {
    if (claimingId) return;
    setClaimingId(q.id);
    try {
      const res = await fetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questId: q.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(language === 'ru' ? `Получено: ${q.reward_fc} FC, ${q.reward_sp} SP!` : `Claimed: ${q.reward_fc} FC, ${q.reward_sp} SP!`);
        if (data.bonusGranted) {
          toast.success(language === 'ru' ? 'СУПЕР-БОНУС ЗА ВСЕ КВЕСТЫ: +500 FC, +50 SP!' : 'ALL QUESTS BONUS: +500 FC, +50 SP!', { duration: 5000, icon: '🏆' });
        }
        setQuests(prev => prev.map(p => p.id === q.id ? { ...p, is_claimed: true } : p));
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(data.error || 'Claim failed');
      }
    } finally {
      setClaimingId(null);
    }
  };

  const getLabel = (type: string) => {
    switch(type) {
      case 'play_match': return language === 'ru' ? 'Сыграть матч' : 'Play a match';
      case 'train_squad': return language === 'ru' ? 'Потренировать состав' : 'Train squad';
      case 'sync_steps': return language === 'ru' ? 'Пройти шаги' : 'Sync steps';
      case 'friendly_match': return language === 'ru' ? 'Товарищеский матч' : 'Friendly match';
      case 'social_action': return language === 'ru' ? 'Вызвать на дуэль/Добавить друга' : 'Social action';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="glass-card-violet p-4 flex items-center justify-center min-h-[100px]">
        <Loader2 className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="glass-card-violet relative overflow-hidden p-4 mb-4 border border-violet-500/30">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent pointer-events-none" />
      
      <div className="flex items-center gap-2 mb-3">
        <Target size={16} className="text-violet-400" />
        <h3 className="text-sm font-black font-orbitron text-white">
          {language === 'ru' ? 'ЕЖЕДНЕВНЫЕ КВЕСТЫ' : 'DAILY QUESTS'}
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {quests.map(q => {
          const pct = Math.min(100, (q.current_value / q.target_value) * 100);
          const done = q.current_value >= q.target_value;
          return (
            <div key={q.id} className="bg-black/30 rounded-xl p-2.5 border border-white/5 relative overflow-hidden">
              <div className="flex justify-between items-center relative z-10">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-200">{getLabel(q.quest_type)}</p>
                  <p className="text-[8px] text-violet-400 font-mono mt-0.5">{q.current_value} / {q.target_value}</p>
                </div>
                {q.is_claimed ? (
                  <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                    <Check size={10} />
                    {language === 'ru' ? 'Выполнено' : 'Done'}
                  </div>
                ) : done ? (
                  <button onClick={() => handleClaim(q)} disabled={claimingId === q.id} className="px-3 py-1 bg-violet-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg shadow-[0_0_10px_rgba(147,51,234,0.4)] active:scale-95 transition-all flex items-center gap-1">
                    {claimingId === q.id ? <Loader2 size={10} className="animate-spin" /> : <Gift size={10} />}
                    {language === 'ru' ? 'Забрать' : 'Claim'}
                  </button>
                ) : (
                  <div className="text-right">
                    <p className="text-[9px] text-yellow-400 font-bold">{q.reward_fc} FC</p>
                    <p className="text-[8px] text-gray-500">+{q.reward_sp} SP</p>
                  </div>
                )}
              </div>
              {!done && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
