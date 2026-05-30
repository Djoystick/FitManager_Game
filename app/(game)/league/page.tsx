import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Medal, Target, Users, Loader2 } from 'lucide-react';
import { requireTeam } from '@/lib/authGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeagueDashboard() {
  const team = await requireTeam();
  if (!team) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch user's active league instance
  const { data: userStanding } = await supabaseAdmin
    .from('league_standings')
    .select('league_instance_id')
    .eq('team_id', team.id)
    .maybeSingle();

  if (!userStanding?.league_instance_id) {
    return (
      <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar justify-center items-center text-center">
        <Trophy className="text-gray-600 mb-4" size={48} />
        <h1 className="text-2xl font-bold font-orbitron text-white">Unassigned</h1>
        <p className="text-gray-400">Your team has not been placed in a league instance yet.</p>
      </div>
    );
  }

  const instanceId = userStanding.league_instance_id;

  // 2. Fetch Instance and Tier details
  const { data: instanceData } = await supabaseAdmin
    .from('league_instances')
    .select(`
      *,
      league_tiers (
        name,
        prize_pool_percentage
      )
    `)
    .eq('id', instanceId)
    .single();

  // 3. Fetch all standings for this instance
  const { data: standingsData } = await supabaseAdmin
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
    .eq('league_instance_id', instanceId)
    .order('points', { ascending: false });

  const standings = standingsData || [];
  
  // Custom sorting: Points DESC, then Goal Difference (GF - GA) DESC
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = (a.goals_for || 0) - (a.goals_against || 0);
    const diffB = (b.goals_for || 0) - (b.goals_against || 0);
    return diffB - diffA;
  });

  const tierName = (instanceData?.league_tiers as any)?.name || 'Unknown Tier';
  const groupName = instanceData?.name || 'Unknown Group';
  const isFilling = instanceData?.status === 'filling';

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col gap-2 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Trophy className="text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" size={28} /> 
          <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider">
            {tierName}
          </h1>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm font-bold text-neon-purple tracking-widest uppercase">{groupName}</p>
          {isFilling ? (
            <span className="flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-900/30 px-3 py-1 rounded-full border border-orange-500/50">
              <Loader2 className="animate-spin" size={14} />
              WAITING FOR TEAMS ({standings.length}/14)
            </span>
          ) : instanceData?.start_time && new Date(instanceData.start_time) > new Date() ? (
            <span className="flex items-center gap-2 text-xs font-bold text-neon-pink bg-neon-pink/10 px-3 py-1 rounded-full border border-neon-pink/50 uppercase">
              <Loader2 className="animate-spin" size={14} />
              Transfer Window
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-6 flex-1 min-h-[500px]">
        {/* Full-width Standings Table */}
        <section className="flex flex-col gap-3 h-auto bg-black/40 border border-gray-800 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)] mb-2 flex items-center justify-between">
            League Standings
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Users size={12} /> {standings.length} Teams
            </span>
          </h2>
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
                    const isCurrentUser = row.team_id === team.id;
                    const rank = index + 1;
                    
                    // Highlight promotion (Top 3) and Relegation (Bottom 3)
                    const isPromotion = rank <= 3;
                    const isRelegation = rank >= 12; // 12, 13, 14 out of 14

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
                        <td className={`px-4 py-3 text-center border-l-4 ${isPromotion ? 'border-neon-green' : isRelegation ? 'border-red-500' : 'border-transparent'}`}>
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
                      <p className="font-bold text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">League is empty.</p>
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
