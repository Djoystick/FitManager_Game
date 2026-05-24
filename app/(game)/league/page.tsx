import React from 'react';
import { supabase } from '@/lib/supabase';
import { PlayMatchButton } from '@/components/league/PlayMatchButton';
import { NextOpponentCard } from '@/components/league/NextOpponentCard';
import { Trophy, Medal, Target } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function LeagueDashboard() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;

  if (!tgUserId) {
    redirect('/profile'); // Fallback if no auth
  }

  // Fetch all standings, sorted by points (descending)
  const { data: standingsData, error } = await supabase
    .from('league_standings')
    .select(`
      *,
      teams (
        id,
        name,
        user_id,
        logo_url
      )
    `)
    .order('points', { ascending: false });

  let standings = standingsData || [];
  
  // Custom sorting: Points DESC, then Goal Difference (GF - GA) DESC
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = (a.goals_for || 0) - (a.goals_against || 0);
    const diffB = (b.goals_for || 0) - (b.goals_against || 0);
    return diffB - diffA;
  });

  // Take top 20
  standings = standings.slice(0, 20);

  // Fetch recent matches
  const { data: matchesData } = await supabase
    .from('matches')
    .select(`
      id, 
      home_score, 
      away_score, 
      match_date,
      home_team:teams!home_team_id (id, name),
      away_team:teams!away_team_id (id, name)
    `)
    .order('match_date', { ascending: false })
    .limit(20);

  const matches = matchesData || [];

  // Identify Current User's Team
  const currentUserTeam = standings.find((s: any) => s.teams?.user_id === tgUserId)?.teams;

  // Next Opponent Logic
  let nextOpponent = null;
  let opponentPlayers: any[] = [];
  let avgOvr = 0;

  if (standings.length > 1) {
    // Pick a random team that is NOT the current user's team
    const possibleOpponents = standings.filter((s: any) => s.teams?.id !== currentUserTeam?.id);
    if (possibleOpponents.length > 0) {
      const randIdx = Math.floor(Math.random() * possibleOpponents.length);
      nextOpponent = possibleOpponents[randIdx]?.teams;

      if (nextOpponent) {
        const { data: playersData } = await supabase
          .from('players')
          .select('name, position, ovr')
          .eq('team_id', nextOpponent.id)
          .eq('lineup_status', 'starting')
          .limit(11);

        if (playersData && playersData.length > 0) {
          opponentPlayers = playersData;
          const totalOvr = playersData.reduce((sum, p) => sum + p.ovr, 0);
          avgOvr = Math.round(totalOvr / playersData.length);
        }
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Trophy className="text-neon-purple" /> 
          Pro League
        </h1>
        <p className="text-sm text-gray-400">Compete against global managers and climb the ranks.</p>
      </header>

      {/* Next Opponent Block */}
      {nextOpponent && (
        <NextOpponentCard 
          opponentTeamName={nextOpponent.name}
          opponentLogoUrl={nextOpponent.logo_url}
          averageOvr={avgOvr}
          starting11={opponentPlayers}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[500px]">
        {/* Left Column: Match History */}
        <section className="flex flex-col gap-3 h-[40vh] md:h-full">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">Recent Matches</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
            {matches.map(match => {
              const isHomeWin = match.home_score > match.away_score;
              const isAwayWin = match.away_score > match.home_score;
              const isDraw = match.home_score === match.away_score;
              
              return (
                <div key={match.id} className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-3 flex flex-col gap-2 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] text-gray-500 font-mono">{new Date(match.match_date).toLocaleString()}</span>
                  <div className="flex justify-between items-center">
                    <div className={`flex-1 text-xs font-bold truncate ${(match.home_team as any)?.id === tgUserId ? 'text-neon-purple' : isHomeWin ? 'text-neon-green' : isDraw ? 'text-gray-300' : 'text-gray-500'}`}>
                      {(match.home_team as any)?.name || 'Unknown'}
                    </div>
                    <div className="px-3 py-1 bg-gray-900 border border-gray-700 rounded font-orbitron text-sm font-black text-white flex gap-2">
                      <span className={isHomeWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : ''}>{match.home_score}</span>
                      <span className="text-gray-500">-</span>
                      <span className={isAwayWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : ''}>{match.away_score}</span>
                    </div>
                    <div className={`flex-1 text-xs font-bold truncate text-right ${(match.away_team as any)?.id === tgUserId ? 'text-neon-purple' : isAwayWin ? 'text-neon-green' : isDraw ? 'text-gray-300' : 'text-gray-500'}`}>
                      {(match.away_team as any)?.name || 'Unknown'}
                    </div>
                  </div>
                </div>
              );
            })}
            {matches.length === 0 && (
              <div className="text-center p-8 bg-black/20 border border-dashed border-gray-800 rounded-lg text-sm text-gray-500 mt-2">
                No recent matches found.
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Standings Table */}
        <section className="flex flex-col gap-3 h-[50vh] md:h-full bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)] mb-2">League Standings</h2>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900/80 text-xs uppercase font-orbitron tracking-widest text-gray-500 border-b border-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-4 w-12 text-center">#</th>
                  <th scope="col" className="px-4 py-4">Club</th>
                  <th scope="col" className="px-4 py-4 text-center">P</th>
                  <th scope="col" className="px-4 py-4 text-center">W</th>
                  <th scope="col" className="px-4 py-4 text-center">D</th>
                  <th scope="col" className="px-4 py-4 text-center">L</th>
                  <th scope="col" className="px-4 py-4 text-center text-neon-green" title="Goals For">GF</th>
                  <th scope="col" className="px-4 py-4 text-center text-red-400" title="Goals Against">GA</th>
                  <th scope="col" className="px-4 py-4 text-center font-black text-white">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.length > 0 ? (
                  standings.map((row, index) => {
                    const isCurrentUser = row.teams?.user_id === tgUserId;
                    const rank = index + 1;
                    
                    return (
                      <tr 
                        key={row.id} 
                        className={`
                          border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors
                          ${isCurrentUser ? 'bg-neon-purple/10 border-l-4 border-l-neon-purple shadow-[inset_0_0_15px_rgba(188,19,254,0.1)]' : 'border-l-4 border-l-transparent'}
                        `}
                      >
                        <td className="px-4 py-3 text-center">
                          {rank === 1 ? (
                            <Medal className="text-yellow-500 mx-auto" size={18} />
                          ) : rank === 2 ? (
                            <Medal className="text-gray-400 mx-auto" size={18} />
                          ) : rank === 3 ? (
                            <Medal className="text-orange-600 mx-auto" size={18} />
                          ) : (
                            <span className="text-gray-500 font-mono">{rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                          <span className={`truncate max-w-[120px] ${isCurrentUser ? 'text-neon-purple' : ''}`}>
                            {row.teams?.name || 'Unknown Team'}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-neon-purple text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 font-mono">{row.matches_played}</td>
                        <td className="px-4 py-3 text-center text-neon-green/80 font-mono">{row.wins}</td>
                        <td className="px-4 py-3 text-center text-gray-500 font-mono">{row.draws}</td>
                        <td className="px-4 py-3 text-center text-red-500/80 font-mono">{row.losses}</td>
                        <td className="px-4 py-3 text-center text-neon-green font-mono">{row.goals_for || 0}</td>
                        <td className="px-4 py-3 text-center text-red-400 font-mono">{row.goals_against || 0}</td>
                        <td className="px-4 py-3 text-center font-black text-white font-orbitron bg-gray-900/50">{row.points}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 bg-black/20">
                      <Target className="mx-auto mb-2 opacity-50" size={32} />
                      <p className="font-bold">No Data Available</p>
                      <p className="text-xs">Play your first match to initialize the league standings.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
