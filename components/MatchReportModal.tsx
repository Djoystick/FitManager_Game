'use client';

import { useEffect } from 'react';

export interface MatchEvent {
  type: 'goal' | 'yellow_card' | 'red_card' | 'injury' | 'penalty_shootout';
  player_id?: string;
  player_name?: string;
  team_id?: string;
  minute?: number;
  score?: string;
  winner_team_id?: string;
}

export interface MatchReport {
  match_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  is_knockout: boolean;
  events: MatchEvent[];
}

interface MatchReportModalProps {
  report: MatchReport;
  userTeamId: string;
  onClose: () => void;
}

export function MatchReportModal({ report, userTeamId, onClose }: MatchReportModalProps) {
  useEffect(() => {
    // Optional: block scrolling
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'goal': return '⚽';
      case 'yellow_card': return '🟨';
      case 'red_card': return '🟥';
      case 'injury': return '🚑';
      case 'penalty_shootout': return '🎯';
      default: return '•';
    }
  };

  const isHome = userTeamId === report.home_team_id;
  const isWin = isHome ? report.home_score > report.away_score : report.away_score > report.home_score;
  const isDraw = report.home_score === report.away_score;
  
  let penaltyResult = '';
  if (report.is_knockout && isDraw) {
    const penEvent = report.events.find(e => e.type === 'penalty_shootout');
    if (penEvent) {
      const userWonPen = penEvent.winner_team_id === userTeamId;
      penaltyResult = `(Pen: ${penEvent.score}) ${userWonPen ? 'WIN' : 'LOSS'}`;
    }
  }

  const resultColor = isDraw && !penaltyResult ? 'text-gray-400' : (isWin || penaltyResult.includes('WIN')) ? 'text-neon-green' : 'text-red-500';
  const resultText = isDraw && !penaltyResult ? 'DRAW' : (isWin || penaltyResult.includes('WIN')) ? 'VICTORY' : 'DEFEAT';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-gray-900 border-2 border-neon-cyan rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.2)] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-neon-cyan/20 to-transparent p-6 text-center border-b border-neon-cyan/30 relative">
          <div className={`text-sm font-black uppercase tracking-widest mb-2 ${resultColor} drop-shadow-[0_0_10px_currentColor]`}>
            {resultText}
          </div>
          
          <div className="flex justify-center items-center gap-6">
            <div className={`text-2xl font-black ${isHome ? 'text-neon-cyan' : 'text-gray-500'}`}>HOME</div>
            <div className="flex flex-col items-center">
              <div className="text-5xl font-black text-white tracking-tighter">
                {report.home_score} - {report.away_score}
              </div>
              {penaltyResult && (
                <div className="text-xs font-bold text-neon-pink mt-1 animate-pulse">{penaltyResult}</div>
              )}
            </div>
            <div className={`text-2xl font-black ${!isHome ? 'text-neon-cyan' : 'text-gray-500'}`}>AWAY</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 bg-black/50 custom-scrollbar">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4 text-center">
            Match Events
          </h3>

          {report.events.length === 0 ? (
            <div className="text-center text-sm text-gray-600 font-mono py-8">No significant events</div>
          ) : (
            <div className="flex flex-col gap-3">
              {report.events.filter(e => e.type !== 'penalty_shootout').map((ev, idx) => {
                const isUserTeam = ev.team_id === userTeamId;
                return (
                  <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${isUserTeam ? 'bg-neon-cyan/5 border-neon-cyan/20' : 'bg-gray-800/30 border-gray-800'}`}>
                    <div className="w-8 text-right text-xs font-orbitron text-gray-400">{ev.minute}'</div>
                    <div className="text-xl drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{getEventIcon(ev.type)}</div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${isUserTeam ? 'text-white' : 'text-gray-400'}`}>
                        {ev.player_name || 'Unknown Player'}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase">
                        {ev.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-lg bg-neon-cyan text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all"
          >
            Continue
          </button>
        </div>

      </div>
    </div>
  );
}
