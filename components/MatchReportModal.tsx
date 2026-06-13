/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useState, useContext } from 'react';
import { MatchEvent } from '@/app/utils/matchEngine';
import { markMatchAsViewed } from '@/app/actions/matchActions';
import { Activity, Shield, Target, AlertCircle, RefreshCcw, Flag, CircleDot, AlertTriangle, CheckCircle, Square, Flame, Radio, Loader2 } from 'lucide-react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

export interface MatchReport {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  events: MatchEvent[];
  round_number?: number;
  home_tactic?: string;
  away_tactic?: string;
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
  const [commentary, setCommentary] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [commentaryLoading, setCommentaryLoading] = useState(true);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // Fetch AI commentary on mount
  useEffect(() => {
    const fetchCommentary = async () => {
      try {
        const res = await fetch('/api/ai/match-commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: report.id }),
        });
        const data = await res.json();
        if (data.success) {
          setCommentary(data.commentary);
          setHighlights(data.highlights || []);
        }
      } catch (err) {
        console.error('Commentary fetch failed:', err);
      } finally {
        setCommentaryLoading(false);
      }
    };
    fetchCommentary();
  }, [report.id]);

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
  const resultText = isDraw ? (t.report_draw || 'DRAW') : isWin ? (t.report_victory || 'VICTORY') : (t.report_defeat || 'DEFEAT');

  const getEventIcon = (type: string) => {
    if (type === 'goal') return <Target className="w-4 h-4 text-neon-green" />;
    if (type === 'save') return <Shield className="w-4 h-4 text-neon-cyan" />;
    if (type === 'yellow_card') return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    if (type === 'second_yellow') return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    if (type === 'red_card') return <Square className="w-4 h-4 text-red-500 fill-red-500" />;
    if (type === 'injury') return <Activity className="w-4 h-4 text-red-500" />;
    if (type === 'substitution') return <RefreshCcw className="w-4 h-4 text-blue-400" />;
    if (type === 'offside') return <Flag className="w-4 h-4 text-yellow-400" />;
    if (type === 'crossbar') return <CircleDot className="w-4 h-4 text-neon-cyan" />;
    if (type === 'own_goal') return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (type === 'penalty_save') return <CheckCircle className="w-4 h-4 text-neon-green" />;
    return <AlertCircle className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-gray-900 border-2 border-neon-cyan rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.2)] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-neon-cyan/20 to-transparent p-6 text-center border-b border-neon-cyan/30 relative">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className={`text-sm font-black uppercase tracking-widest ${resultColor} drop-shadow-[0_0_10px_currentColor]`}>
              {resultText}
            </div>
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

          {/* Tactics display */}
          {(report.home_tactic || report.away_tactic) && (
            <div className="flex justify-between items-center px-4 mt-2">
              <div className="text-[9px] text-neon-cyan/60 font-bold uppercase tracking-wider">
                {report.home_tactic || 'Balanced'}
              </div>
              <div className="text-[8px] text-gray-600 uppercase tracking-widest">{t.report_tactic_label || 'Tactic'}</div>
              <div className="text-[9px] text-neon-cyan/60 font-bold uppercase tracking-wider text-right">
                {report.away_tactic || 'Balanced'}
              </div>
            </div>
          )}

          {/* Derby badge */}
          {(report as any).is_derby && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <Flame className="text-orange-500" size={12} />
              <span className="text-[9px] text-orange-400 font-black uppercase tracking-widest">DERBY</span>
              <Flame className="text-orange-500" size={12} />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto max-h-[40vh] p-4 bg-black/50 custom-scrollbar">
          {/* AI Commentary Section */}
          {commentaryLoading ? (
            <div className="p-3 text-center mb-3">
              <Loader2 className="animate-spin text-cyan-400 mx-auto" size={14} />
              <p className="text-[9px] text-gray-500 mt-1">Комментарий загружается...</p>
            </div>
          ) : commentary ? (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/5 to-violet-500/5 border border-cyan-500/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Radio className="text-cyan-400" size={10} />
                <span className="text-[8px] text-cyan-400 font-black uppercase tracking-widest">Live Commentary</span>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed whitespace-pre-line">{commentary}</p>
              {highlights.length > 0 && (
                <div className="mt-2 pt-2 border-t border-cyan-500/10">
                  {highlights.map((h, i) => (
                    <p key={i} className="text-[9px] text-gray-400 flex items-start gap-1.5 mt-1">
                      <span className="text-cyan-400">▸</span> {h}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4 text-center">
            {t.report_match_events || 'Match Events'}
          </h3>

          {report.events?.length === 0 ? (
            <div className="text-center text-sm text-gray-600 font-mono py-8">{t.report_no_events || 'No significant events'}</div>
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
                              {ev.player_id && ev.player_id !== 'sys' && (
                                <img 
                                  src={`https://api.dicebear.com/9.x/micah/svg?seed=${ev.player_id}&backgroundColor=transparent`} 
                                  alt="avatar" 
                                  className="w-4 h-4 rounded-full bg-black/50" 
                                />
                              )}
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
                              {ev.player_id && ev.player_id !== 'sys' && (
                                <img 
                                  src={`https://api.dicebear.com/9.x/micah/svg?seed=${ev.player_id}&backgroundColor=transparent`} 
                                  alt="avatar" 
                                  className="w-4 h-4 rounded-full bg-black/50" 
                                />
                              )}
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
            <span>{t.report_stamina_drain || 'Squad Stamina Drain: ~20%'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <button 
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full py-4 rounded-lg bg-neon-cyan text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (t.report_processing || 'Processing...') : (t.report_accept || 'Accept Report')}
          </button>
        </div>

      </div>
    </div>
  );
}
