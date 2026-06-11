'use client';

import { useContext } from 'react';
import { X } from 'lucide-react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

interface UnseenMatch {
  id: string;
  opponent: string;
  gf: number;
  ga: number;
  result: 'win' | 'draw' | 'loss';
}

interface UnseenMatchesModalProps {
  matches: UnseenMatch[];
  onAcknowledge: (matchIds: string[]) => void;
  onViewStats?: (matchId: string) => void;
}

export function UnseenMatchesModal({ matches, onAcknowledge, onViewStats }: UnseenMatchesModalProps) {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];
  if (!matches || matches.length === 0) return null;

  const handleAcknowledge = () => {
    onAcknowledge(matches.map(m => m.id));
  };

  const isSingle = matches.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-black/60 p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-widest text-white font-orbitron">
            {isSingle ? (t.unseen_single_title || 'Матч завершен!') : (t.unseen_multi_title || 'Непросмотренные матчи')}
          </h2>
          <button onClick={handleAcknowledge} className="p-1 rounded-full hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {isSingle ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2">
                {t.unseen_vs || 'VS'} {matches[0].opponent}
              </span>
              <div className="flex items-center justify-center gap-4">
                <span className={`text-4xl font-black font-orbitron ${matches[0].result === 'win' ? 'text-neon-green' : matches[0].result === 'loss' ? 'text-red-500' : 'text-gray-300'}`}>
                  {matches[0].gf}
                </span>
                <span className="text-xl font-black text-gray-600">-</span>
                <span className="text-4xl font-black font-orbitron text-gray-500">
                  {matches[0].ga}
                </span>
              </div>
              <span className={`mt-4 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${matches[0].result === 'win' ? 'bg-green-900/30 text-neon-green border border-neon-green/30' : matches[0].result === 'loss' ? 'bg-red-900/30 text-red-500 border border-red-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                {matches[0].result === 'win' ? (t.unseen_win || 'Победа') : matches[0].result === 'loss' ? (t.unseen_loss || 'Поражение') : (t.unseen_draw || 'Ничья')}
              </span>
              
              {onViewStats && (
                <button
                  onClick={() => onViewStats(matches[0].id)}
                  className="mt-6 px-4 py-2 border border-neon-cyan/50 text-neon-cyan rounded-lg text-xs font-black uppercase tracking-widest hover:bg-neon-cyan/10 transition-colors"
                >
                  {t.unseen_view_stats || 'Посмотреть статистику'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400 mb-2">{t.unseen_count_msg?.replace('{count}', String(matches.length)) || `Пока вас не было, команда сыграла ${matches.length} матчей:`}</p>
              {matches.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {m.result === 'win' ? '✅' : m.result === 'loss' ? '❌' : '➖'}
                    </span>
                    <span className="text-xs font-bold text-gray-300 truncate max-w-[120px]">
                      vs {m.opponent}
                    </span>
                  </div>
                  <span className={`text-sm font-black font-orbitron ${m.result === 'win' ? 'text-neon-green' : m.result === 'loss' ? 'text-red-500' : 'text-gray-400'}`}>
                    {m.gf} - {m.ga}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-gray-800">
          <button
            onClick={handleAcknowledge}
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 bg-neon-cyan text-black hover:bg-neon-cyan/90 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
          >
            {isSingle ? (t.unseen_accept_single || 'Принять') : (t.unseen_accept_multi || 'Отметить все как прочитанные')}
          </button>
        </div>

      </div>
    </div>
  );
}
