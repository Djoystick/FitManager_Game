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
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
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
          
          <div className="flex justify-between items-center px-4">
            <div className={`flex-1 text-right text-lg font-black uppercase truncate pr-4 ${isHome ? 'text-neon-cyan' : 'text-gray-400'}`}>
              {report.home_team_name}
            </div>
            <div className="flex flex-col items-center shrink-0 w-24">
              <div className="text-4xl font-black text-white tracking-tighter">
                {report.home_score} - {report.away_score}
              </div>
              {penaltyResult && (
                <div className="text-[10px] font-bold text-neon-pink mt-1 animate-pulse whitespace-nowrap">{penaltyResult}</div>
              )}
            </div>
            <div className={`flex-1 text-left text-lg font-black uppercase truncate pl-4 ${!isHome ? 'text-neon-cyan' : 'text-gray-400'}`}>
              {report.away_team_name}
            </div>
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
            <div className="flex flex-col gap-2 relative">
              {/* Center Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-800 -translate-x-1/2" />
              
              {report.events.filter(e => e.type !== 'penalty_shootout').map((ev, idx) => {
                const isHomeEvent = ev.team_id === report.home_team_id;
                const isUserTeam = ev.team_id === userTeamId;
                
                return (
                  <div key={idx} className="flex items-center w-full relative z-10 my-1">
                    {/* Left Column (Home) */}
                    <div className="flex-1 pr-4 flex justify-end items-center">
                      {isHomeEvent && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border max-w-[95%] ${isUserTeam ? 'bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]' : 'bg-gray-800/80 border-gray-700'}`}>
                          <div className="flex flex-col text-right truncate">
                            <span className={`text-xs font-bold truncate ${isUserTeam ? 'text-white' : 'text-gray-300'}`}>
                              {ev.player_name || 'Unknown'}
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase">
                              {ev.type.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-base drop-shadow-[0_0_3px_rgba(255,255,255,0.5)] flex-shrink-0">
                            {getEventIcon(ev.type)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Center (Minute) */}
                    <div className="w-8 h-8 rounded-full bg-black border border-gray-700 flex items-center justify-center shrink-0 z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                      <span className="text-[10px] font-orbitron font-bold text-neon-cyan">{ev.minute}'</span>
                    </div>
                    
                    {/* Right Column (Away) */}
                    <div className="flex-1 pl-4 flex justify-start items-center">
                      {!isHomeEvent && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border max-w-[95%] ${isUserTeam ? 'bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]' : 'bg-gray-800/80 border-gray-700'}`}>
                          <div className="text-base drop-shadow-[0_0_3px_rgba(255,255,255,0.5)] flex-shrink-0">
                            {getEventIcon(ev.type)}
                          </div>
                          <div className="flex flex-col text-left truncate">
                            <span className={`text-xs font-bold truncate ${isUserTeam ? 'text-white' : 'text-gray-300'}`}>
                              {ev.player_name || 'Unknown'}
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase">
                              {ev.type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      )}
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
