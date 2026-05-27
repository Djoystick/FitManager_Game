'use client';

import { useEffect, useState } from 'react';
import { MatchEvent } from '@/app/utils/matchEngine';
import { markMatchAsViewed } from '@/app/actions/matchActions';
import { Activity, Shield, Target, AlertCircle } from 'lucide-react';

export interface MatchReport {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  events: MatchEvent[];
  stamina_drain?: {
    home: Record<string, number>;
    away: Record<string, number>;
  };
}

interface MatchReportModalProps {
  report: MatchReport;
  userTeamId: string;
  onClose: () => void;
}

export function MatchReportModal({ report, userTeamId, onClose }: MatchReportModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleAccept = async () => {
    setIsSubmitting(true);
    await markMatchAsViewed(report.id);
    setIsSubmitting(false);
    onClose();
  };

  const isHome = userTeamId === report.home_team_id;
  const isWin = isHome ? report.home_score > report.away_score : report.away_score > report.home_score;
  const isDraw = report.home_score === report.away_score;
  
  const resultColor = isDraw ? 'text-gray-400' : isWin ? 'text-neon-green' : 'text-red-500';
  const resultText = isDraw ? 'DRAW' : isWin ? 'VICTORY' : 'DEFEAT';

  const getEventIcon = (type: string) => {
    if (type === 'goal') return <Target className="w-4 h-4 text-neon-green" />;
    if (type === 'save') return <Shield className="w-4 h-4 text-neon-cyan" />;
    return <AlertCircle className="w-4 h-4 text-gray-500" />;
  };

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
            </div>
            <div className={`flex-1 text-left text-lg font-black uppercase truncate pl-4 ${!isHome ? 'text-neon-cyan' : 'text-gray-400'}`}>
              {report.away_team_name}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] p-4 bg-black/50 custom-scrollbar">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4 text-center">
            Match Events
          </h3>

          {report.events?.length === 0 ? (
            <div className="text-center text-sm text-gray-600 font-mono py-8">No significant events</div>
          ) : (
            <div className="flex flex-col gap-3 relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-800 -translate-x-1/2" />
              
              {report.events?.map((ev, idx) => {
                const evTeamId = ev.team === 'home' ? report.home_team_id : report.away_team_id;
                const isHomeEvent = evTeamId === report.home_team_id;
                const isUserTeam = evTeamId === userTeamId;
                
                return (
                  <div key={idx} className="flex items-center w-full relative z-10 my-1">
                    <div className="flex-1 pr-4 flex justify-end items-center">
                      {isHomeEvent && (
                        <div className={`flex flex-col text-right p-2 rounded-lg border w-[95%] ${isUserTeam ? 'bg-neon-cyan/10 border-neon-cyan/30' : 'bg-gray-800/80 border-gray-700'}`}>
                           <div className="flex items-center justify-end gap-1 mb-1">
                              <span className={`text-xs font-bold truncate ${isUserTeam ? 'text-white' : 'text-gray-300'}`}>{ev.player_name}</span>
                              {getEventIcon(ev.type)}
                           </div>
                           <span className="text-[9px] text-gray-400 whitespace-normal line-clamp-2 leading-tight">{ev.details}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-8 h-8 rounded-full bg-black border border-gray-700 flex items-center justify-center shrink-0 z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                      <span className="text-[10px] font-orbitron font-bold text-neon-cyan">{ev.minute}'</span>
                    </div>
                    
                    <div className="flex-1 pl-4 flex justify-start items-center">
                      {!isHomeEvent && (
                        <div className={`flex flex-col text-left p-2 rounded-lg border w-[95%] ${isUserTeam ? 'bg-neon-cyan/10 border-neon-cyan/30' : 'bg-gray-800/80 border-gray-700'}`}>
                           <div className="flex items-center justify-start gap-1 mb-1">
                              {getEventIcon(ev.type)}
                              <span className={`text-xs font-bold truncate ${isUserTeam ? 'text-white' : 'text-gray-300'}`}>{ev.player_name}</span>
                           </div>
                           <span className="text-[9px] text-gray-400 whitespace-normal line-clamp-2 leading-tight">{ev.details}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stamina Drain Summary */}
        <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 flex justify-center">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Activity className="w-4 h-4 text-neon-pink" />
            <span>Squad Stamina Drain: <strong className="text-neon-pink">~20%</strong></span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <button 
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full py-4 rounded-lg bg-neon-cyan text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Accept Report'}
          </button>
        </div>

      </div>
    </div>
  );
}
