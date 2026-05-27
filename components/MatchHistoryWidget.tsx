'use client';

import { useEffect, useState } from 'react';
import { getMatchHistory } from '@/app/actions/matchActions';
import { MatchReport, MatchReportModal } from '@/components/MatchReportModal';
import { BookOpen } from 'lucide-react';

export function MatchHistoryWidget({ userId, teamName }: { userId: string; teamName: string | null }) {
  const [history, setHistory] = useState<MatchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MatchReport | null>(null);
  const [userTeamId, setUserTeamId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await getMatchHistory(userId);
        if (mounted && res.success && res.data) {
          setHistory(res.data);
          
          // Find user's team ID from the first match if available
          if (res.data.length > 0) {
            const firstMatch = res.data[0];
            if (firstMatch.home_team_name === teamName) {
              setUserTeamId(firstMatch.home_team_id);
            } else if (firstMatch.away_team_name === teamName) {
              setUserTeamId(firstMatch.away_team_id);
            } else {
              // Fallback
              const tId = res.data[0].home_team_id; // Approximation, better to get it from server explicitly if needed
              setUserTeamId(tId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load history', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchHistory();

    // Listen for simulation updates to refresh history
    const handleSimulation = () => fetchHistory();
    window.addEventListener('matchSimulated', handleSimulation);

    return () => {
      mounted = false;
      window.removeEventListener('matchSimulated', handleSimulation);
    };
  }, [userId, teamName]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-2">
        <BookOpen className="text-neon-pink w-5 h-5" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,100,0.5)]">
          Match Journal
        </h2>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col min-h-[150px]">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center p-8">
            <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-gray-500">
            <p className="text-xs uppercase tracking-widest">No matches played yet</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-800/50">
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${isDraw ? 'bg-gray-800 text-gray-400' : isWin ? 'bg-green-900/30 text-neon-green border border-neon-green/30' : 'bg-red-900/30 text-red-500 border border-red-500/30'}`}>
                      {resultLetter}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <span className={`text-xs font-bold truncate ${isHome ? 'text-white' : 'text-gray-400'}`}>
                          {match.home_team_name}
                        </span>
                        <span className="text-xs font-black text-white shrink-0 font-orbitron w-10 text-center">
                          {match.home_score} - {match.away_score}
                        </span>
                        <span className={`text-xs font-bold truncate text-right ${!isHome ? 'text-white' : 'text-gray-400'}`}>
                          {match.away_team_name}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
