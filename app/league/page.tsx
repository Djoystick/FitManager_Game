'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import Link from 'next/link';

interface LeagueStanding {
  team_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface MatchHistory {
  id: string;
  home_score: number;
  away_score: number;
  match_date: string;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
}

export default function LeaguePage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = userId ? `/api/league/standings?userId=${userId}` : '/api/league/standings';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setStandings(data.standings);
            setMatches(data.recentMatches);
            setUserTeamId(data.userTeamId);
          }
        }
      } catch (err) {
        console.error("Failed to load league data", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isAuthLoading) {
      fetchData();
    }
  }, [userId, isAuthLoading]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 h-full pb-20">
      
      {/* Header */}
      <header className="flex justify-between items-center border-b border-gray-800 pb-2">
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
          Global League
        </h1>
        <Link href="/" className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-neon-cyan hover:border-neon-cyan transition-colors shadow-inner">
          Back
        </Link>
      </header>

      {/* Adding support for medium screens via md:grid-cols-2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-[600px]">
        
        {/* Left Column: Match History */}
        <section className="flex flex-col gap-3 h-[40vh] md:h-full">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">Recent Matches</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
            {matches.map(match => {
              const isHomeWin = match.home_score > match.away_score;
              const isAwayWin = match.away_score > match.home_score;
              const isDraw = match.home_score === match.away_score;
              
              return (
                <div key={match.id} className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-lg p-3 flex flex-col gap-2 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] text-gray-500 font-mono">{new Date(match.match_date).toLocaleString()}</span>
                  <div className="flex justify-between items-center">
                    <div className={`flex-1 text-xs font-bold truncate ${isHomeWin ? 'text-neon-green' : isDraw ? 'text-gray-300' : 'text-gray-500'}`}>
                      {match.home_team?.name || 'Unknown'}
                    </div>
                    <div className="px-3 py-1 bg-gray-900 border border-gray-700 rounded font-orbitron text-sm font-black text-white flex gap-2">
                      <span className={isHomeWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : ''}>{match.home_score}</span>
                      <span className="text-gray-500">-</span>
                      <span className={isAwayWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : ''}>{match.away_score}</span>
                    </div>
                    <div className={`flex-1 text-xs font-bold truncate text-right ${isAwayWin ? 'text-neon-green' : isDraw ? 'text-gray-300' : 'text-gray-500'}`}>
                      {match.away_team?.name || 'Unknown'}
                    </div>
                  </div>
                </div>
              );
            })}
            {matches.length === 0 && (
              <div className="text-center text-sm text-gray-500 mt-10">No recent matches found.</div>
            )}
          </div>
        </section>

        {/* Right Column: Standings Table */}
        <section className="flex flex-col gap-3 h-[50vh] md:h-full">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">League Standings</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] relative">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900/90 backdrop-blur-xl sticky top-0 z-10 border-b border-gray-700 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Team</th>
                  <th className="p-3 w-8 text-center text-neon-green">W</th>
                  <th className="p-3 w-8 text-center text-gray-400">D</th>
                  <th className="p-3 w-8 text-center text-red-400">L</th>
                  <th className="p-3 w-12 text-center text-neon-cyan">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 font-mono relative z-0">
                {standings.map((team, idx) => {
                  const isCurrentUser = team.team_id === userTeamId;
                  return (
                    <tr 
                      key={team.team_id} 
                      className={`hover:bg-gray-800/50 transition-colors ${
                        isCurrentUser 
                          ? 'bg-neon-cyan/10 border-l-2 border-r-2 border-neon-cyan shadow-[inset_0_0_15px_rgba(0,240,255,0.2)] relative z-20' 
                          : ''
                      }`}
                    >
                      <td className="p-3 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className={`p-3 truncate max-w-[120px] ${isCurrentUser ? 'text-neon-cyan font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]' : 'text-gray-300'}`}>
                        {team.team_name}
                      </td>
                      <td className="p-3 text-center">{team.wins}</td>
                      <td className="p-3 text-center text-gray-500">{team.draws}</td>
                      <td className="p-3 text-center text-gray-600">{team.losses}</td>
                      <td className="p-3 text-center font-bold text-white bg-gray-900/50">{team.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {standings.length === 0 && (
              <div className="text-center text-sm text-gray-500 mt-10">No standings available.</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
