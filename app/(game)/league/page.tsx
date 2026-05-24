import React from 'react';
import { supabase } from '@/lib/supabase';
import { PlayMatchButton } from '@/components/league/PlayMatchButton';
import { Trophy, Medal, Target } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function LeagueDashboard() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;

  if (!tgUserId) {
    redirect('/profile'); // Fallback if no auth
  }

  // Fetch all standings, sorted by points (descending), then by goal difference or wins (for simplicity, we sort by points and wins)
  // We use the teams table to get the names and logos
  const { data: standingsData, error } = await supabase
    .from('league_standings')
    .select(`
      *,
      teams (
        id,
        name,
        user_id
      )
    `)
    .order('points', { ascending: false })
    .order('wins', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to load league standings:", error);
  }

  const standings = standingsData || [];

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-gray-800 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
            <Trophy className="text-neon-purple" /> 
            Pro League
          </h1>
          <p className="text-sm text-gray-400">Compete against global managers and climb the ranks.</p>
        </div>
        
        {/* Play Match CTA */}
        <PlayMatchButton />
      </header>

      {/* Standings Table */}
      <section className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs uppercase font-orbitron tracking-widest text-gray-500 border-b border-gray-800">
              <tr>
                <th scope="col" className="px-4 py-4 w-12 text-center">Pos</th>
                <th scope="col" className="px-4 py-4">Club</th>
                <th scope="col" className="px-4 py-4 text-center">P</th>
                <th scope="col" className="px-4 py-4 text-center">W</th>
                <th scope="col" className="px-4 py-4 text-center">D</th>
                <th scope="col" className="px-4 py-4 text-center">L</th>
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
                        ${isCurrentUser ? 'bg-neon-purple/10 border-l-4 border-l-neon-purple' : 'border-l-4 border-l-transparent'}
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
                        {row.teams?.name || 'Unknown Team'}
                        {isCurrentUser && (
                          <span className="text-[10px] bg-neon-purple text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 font-mono">{row.matches_played}</td>
                      <td className="px-4 py-3 text-center text-neon-green/80 font-mono">{row.wins}</td>
                      <td className="px-4 py-3 text-center text-gray-500 font-mono">{row.draws}</td>
                      <td className="px-4 py-3 text-center text-red-500/80 font-mono">{row.losses}</td>
                      <td className="px-4 py-3 text-center font-black text-white font-orbitron">{row.points}</td>
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
  );
}
