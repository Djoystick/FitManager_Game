'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MatchResult {
  id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  match_date: string;
}

export default function JournalPage() {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch('/api/match/history');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMatches(data.matches);
          }
        }
      } catch (error) {
        console.error("Failed to fetch matches", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Determine color based on score difference to stylize win/loss outcomes cleanly
  const getScoreColor = (home: number, away: number, isHome: boolean) => {
    if (home === away) return 'text-gray-400';
    const isWinner = isHome ? home > away : away > home;
    return isWinner 
      ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' 
      : 'text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.8)]';
  };

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 min-h-screen bg-space-dark text-white">
      {/* HEADER */}
      <header className="border-b border-gray-800 pb-4">
        <Link href="/" className="text-xs text-neon-cyan hover:underline mb-2 inline-block">&larr; Dashboard</Link>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Match <span className="text-neon-green">Journal</span></h1>
        <p className="text-sm text-gray-400 mt-1">Live simulation results from the global league.</p>
      </header>

      {/* FEED */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-neon-green border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : matches.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl p-8">
          <span className="text-xl font-black text-neon-green drop-shadow-[0_0_10px_rgba(57,255,20,0.8)] uppercase tracking-widest text-center">No Matches Logged</span>
          <p className="text-gray-500 text-xs mt-2 text-center">The first global CRON simulation is pending.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-10">
          {matches.map((match) => (
            <div key={match.id} className="bg-black/60 border border-gray-800 p-4 rounded-xl flex flex-col shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all hover:border-gray-700">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest text-center mb-3">
                {new Date(match.match_date).toLocaleString()}
              </span>
              
              <div className="flex items-center justify-between font-mono">
                <div className="flex-1 text-right pr-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{match.home_team_name}</span>
                </div>
                
                <div className="flex items-center justify-center gap-3 bg-gray-900 px-4 py-2 rounded-lg border border-gray-800 shadow-inner">
                  <span className={`text-xl font-black ${getScoreColor(match.home_score, match.away_score, true)}`}>
                    {match.home_score}
                  </span>
                  <span className="text-gray-700 text-sm">-</span>
                  <span className={`text-xl font-black ${getScoreColor(match.home_score, match.away_score, false)}`}>
                    {match.away_score}
                  </span>
                </div>

                <div className="flex-1 text-left pl-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{match.away_team_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
