'use client';

import { useEffect, useState } from 'react';
import { getMatchHistory, getMatchSchedule } from '@/app/actions/matchActions';
import { MatchReport, MatchReportModal } from '@/components/MatchReportModal';
import { BookOpen, CalendarDays } from 'lucide-react';

import { dict } from '@/lib/dictionaries';

export function MatchHistoryWidget({ userId, teamName, language = 'en' }: { userId: string; teamName: string | null; language?: string }) {
  const t = dict[language as keyof typeof dict];
  const [history, setHistory] = useState<MatchReport[]>([]);
  const [schedule, setSchedule] = useState<MatchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MatchReport | null>(null);
  const [userTeamId, setUserTeamId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'journal' | 'schedule'>('journal');

  useEffect(() => {
    let mounted = true;

    const fetchMatches = async () => {
      setIsLoading(true);
      try {
        const [histRes, schedRes] = await Promise.all([
          getMatchHistory(userId),
          getMatchSchedule(userId)
        ]);

        if (mounted) {
          if (histRes.success && histRes.data) {
            setHistory(histRes.data);
            if (histRes.data.length > 0) {
              const firstMatch = histRes.data[0];
              setUserTeamId(
                firstMatch.home_team_name === teamName ? firstMatch.home_team_id :
                firstMatch.away_team_name === teamName ? firstMatch.away_team_id :
                firstMatch.home_team_id
              );
            }
          }
          if (schedRes.success && schedRes.data) {
            setSchedule(schedRes.data);
            if (schedRes.data.length > 0 && !userTeamId) {
              const firstMatch = schedRes.data[0];
              setUserTeamId(
                firstMatch.home_team_name === teamName ? firstMatch.home_team_id :
                firstMatch.away_team_name === teamName ? firstMatch.away_team_id :
                firstMatch.home_team_id
              );
            }
          }
        }
      } catch (err) {
        console.error('Failed to load matches', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMatches();

    // Listen for simulation updates to refresh history
    const handleSimulation = () => fetchMatches();
    window.addEventListener('matchSimulated', handleSimulation);

    return () => {
      mounted = false;
      window.removeEventListener('matchSimulated', handleSimulation);
    };
  }, [userId, teamName]);

  return (
    <div className="flex flex-col gap-3">
      {/* TABS */}
      <div className="flex justify-center mt-1 mb-1 z-10 relative shrink-0">
        <div className="bg-black/40 p-0.5 rounded-full border border-gray-800 flex shadow-sm backdrop-blur-md relative overflow-hidden">
          <div 
            className={`absolute top-0.5 bottom-0.5 w-[48%] bg-white/10 rounded-full transition-transform duration-300 ease-out border border-white/20 ${viewMode === 'journal' ? 'translate-x-[2%]' : 'translate-x-[102%]'}`}
          ></div>
          <button
            onClick={() => setViewMode('journal')}
            className={`relative px-4 py-1 text-[10px] z-10 font-black uppercase tracking-widest rounded-full transition-colors duration-300 w-32 ${
              viewMode === 'journal'
                ? 'text-neon-pink drop-shadow-[0_0_8px_rgba(255,0,100,0.8)]'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            {t.match_journal_title || 'Match Journal'}
          </button>
          <button
            onClick={() => setViewMode('schedule')}
            className={`relative px-4 py-1 text-[10px] z-10 font-black uppercase tracking-widest rounded-full transition-colors duration-300 w-32 ${
              viewMode === 'schedule'
                ? 'text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            Schedule
          </button>
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center p-8">
            <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${viewMode === 'journal' ? 'border-neon-pink' : 'border-neon-cyan'}`}></div>
          </div>
        ) : viewMode === 'journal' ? (
          history.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center p-8 text-gray-500">
              <p className="text-xs uppercase tracking-widest">{t.no_matches_yet || 'No matches played yet'}</p>
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-gray-800/50 max-h-[175px] overflow-y-auto custom-scrollbar">
            {history.map((match) => {
              const isHome = match.home_team_id === userTeamId;
              const isWin = isHome ? match.home_score > match.away_score : match.away_score > match.home_score;
              const isDraw = match.home_score === match.away_score;
              const resultColor = isDraw ? 'text-gray-400' : isWin ? 'text-neon-green' : 'text-red-500';
              const resultLetter = isDraw ? 'D' : isWin ? 'W' : 'L';

              return (
                <button
                  key={match.id}
                  onClick={() => setSelectedReport(match)}
                  className="flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors text-left active:bg-gray-800"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${isDraw ? 'bg-gray-800 text-gray-400' : isWin ? 'bg-green-900/30 text-neon-green border border-neon-green/30' : 'bg-red-900/30 text-red-500 border border-red-500/30'}`}>
                      {resultLetter}
                    </div>
                    <div className="flex flex-1 items-center gap-1 min-w-0">
                      <span className={`flex-1 text-xs font-bold truncate text-right ${isHome ? 'text-white' : 'text-gray-400'}`}>
                        {match.home_team_name}
                      </span>
                      <span className="w-14 shrink-0 text-xs font-black text-white font-orbitron text-center">
                        {match.home_score} - {match.away_score}
                      </span>
                      <span className={`flex-1 text-xs font-bold truncate text-left ${!isHome ? 'text-white' : 'text-gray-400'}`}>
                        {match.away_team_name}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          schedule.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center p-8 text-gray-500">
              <p className="text-xs uppercase tracking-widest text-center">No upcoming matches.<br/>League filling.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-800/50 max-h-[175px] overflow-y-auto custom-scrollbar">
              {schedule.map((match) => {
                const isHome = match.home_team_id === userTeamId;
                return (
                  <div key={match.id} className="flex items-center justify-between p-3 bg-gray-900/20 text-left">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                        {match.round_number}
                      </div>
                      <div className="flex flex-1 items-center gap-1 min-w-0">
                        <span className={`flex-1 text-xs font-bold truncate text-right ${isHome ? 'text-white' : 'text-gray-400'}`}>
                          {match.home_team_name}
                        </span>
                        <span className="w-14 shrink-0 text-[10px] font-black text-neon-cyan/70 font-orbitron text-center uppercase tracking-widest">
                          VS
                        </span>
                        <span className={`flex-1 text-xs font-bold truncate text-left ${!isHome ? 'text-white' : 'text-gray-400'}`}>
                          {match.away_team_name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {selectedReport && (
        <MatchReportModal
          report={selectedReport}
          userTeamId={userTeamId}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
