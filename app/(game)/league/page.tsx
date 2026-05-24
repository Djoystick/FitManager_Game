import React from 'react';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Medal, Target } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeagueDashboard() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;

  if (!tgUserId) {
    redirect('/profile'); // Fallback if no auth
  }

  // Initialize Admin client to completely bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. AUTO-REGISTER CURRENT USER TO STANDINGS
  if (tgUserId) {
    const { data: userTeamData } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (userTeamData?.id) {
      const { data: existingStanding } = await supabaseAdmin
        .from('league_standings')
        .select('id')
        .eq('team_id', userTeamData.id)
        .single();

      if (!existingStanding) {
        const { error: insertError } = await supabaseAdmin.from('league_standings').insert({
          team_id: userTeamData.id,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0
        });
        if (insertError) {
          console.error("CRITICAL LEAGUE INSERT ERROR:", insertError);
        }
      }
    }
  }

  // 2. Fetch all standings, sorted by points (descending)
  const { data: standingsData, error } = await supabaseAdmin
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

  // Identify Current User's Team (for highlighting in the table)
  const currentUserTeam = standings.find((s: any) => s.teams?.user_id === tgUserId)?.teams;

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Trophy className="text-neon-purple" /> 
          Pro League Standings
        </h1>
        <p className="text-sm text-gray-400">Compete against global managers and climb the ranks.</p>
      </header>

      <div className="flex flex-col gap-6 flex-1 min-h-[500px]">
        {/* Full-width Standings Table */}
        <section className="flex flex-col gap-3 h-auto bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4">
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
                          transition-colors
                          ${isCurrentUser 
                            ? 'bg-white/10 border border-neon-cyan/50 text-white font-bold shadow-[inset_0_0_15px_rgba(0,240,255,0.15)] relative z-10' 
                            : 'border-b border-gray-800/50 hover:bg-gray-800/30'}
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
                        <td className={`px-4 py-3 font-bold flex items-center gap-2 ${isCurrentUser ? 'text-neon-cyan' : 'text-white'}`}>
                          <span className="truncate max-w-[120px]">
                            {row.teams?.name || 'Unknown Team'}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-neon-cyan text-black font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                              You
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-white' : 'text-gray-500'}`}>{row.matches_played}</td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-neon-green' : 'text-neon-green/80'}`}>{row.wins}</td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-white' : 'text-gray-500'}`}>{row.draws}</td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-red-400' : 'text-red-500/80'}`}>{row.losses}</td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-neon-green font-bold' : 'text-neon-green'}`}>{row.goals_for || 0}</td>
                        <td className={`px-4 py-3 text-center font-mono ${isCurrentUser ? 'text-red-400 font-bold' : 'text-red-400'}`}>{row.goals_against || 0}</td>
                        <td className={`px-4 py-3 text-center font-black font-orbitron ${isCurrentUser ? 'text-neon-cyan bg-neon-cyan/10' : 'text-white bg-gray-900/50'}`}>{row.points}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 bg-black/20">
                      <Target className="mx-auto mb-2 opacity-50" size={32} />
                      <p className="font-bold text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">League is empty. Seed bots.</p>
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
