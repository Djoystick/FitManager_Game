import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Medal, Target, Users, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
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

  const { data: userStandings } = await supabaseAdmin
    .from('league_standings')
    .select('league_instance_id, league_instances!inner(status)')
    .eq('team_id', team.id)
    .in('league_instances.status', ['active', 'filling'])
    .limit(1);

  const userStanding = userStandings?.[0];

  if (!userStanding?.league_instance_id) {
    return (
      <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar justify-center items-center text-center"
           style={{ background: '#05060f' }}>
        <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mb-2">
          <Trophy className="text-gray-600" size={32} />
        </div>
        <h1 className="text-xl font-bold font-orbitron text-white">Unassigned</h1>
        <p className="text-gray-500 text-sm">Your team has not been placed in a league instance yet.</p>
      </div>
    );
  }

  const instanceId = userStanding.league_instance_id;

  const { data: instanceData } = await supabaseAdmin
    .from('league_instances')
    .select(`*, league_tiers (name, prize_pool_percentage)`)
    .eq('id', instanceId)
    .single();

  const { data: standingsData } = await supabaseAdmin
    .from('league_standings')
    .select(`*, teams (id, name, user_id, logo_url)`)
    .eq('league_instance_id', instanceId)
    .order('points', { ascending: false });

  const standings = standingsData || [];
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = (a.goals_for || 0) - (a.goals_against || 0);
    const diffB = (b.goals_for || 0) - (b.goals_against || 0);
    return diffB - diffA;
  });

  const tierName  = (instanceData?.league_tiers as any)?.name || 'Unknown Tier';
  const groupName = instanceData?.name || 'Unknown Group';
  const isFilling = instanceData?.status === 'filling';

  const userRank = standings.findIndex(s => s.team_id === team.id) + 1;

  return (
    <div
      className="flex flex-col flex-1 pb-24 h-full overflow-y-auto custom-scrollbar"
      style={{ background: '#05060f' }}
    >
      {/* ── Background ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-60" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="relative z-10 p-4 pb-0">
        <div className="glass-card-violet relative overflow-hidden p-4">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
                <Trophy className="text-violet-400 drop-shadow-[0_0_8px_rgba(147,51,234,0.8)]" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black font-orbitron text-white uppercase tracking-wider">{tierName}</h1>
                <p className="text-[10px] text-violet-400/70 uppercase tracking-widest">{groupName}</p>
              </div>
            </div>

            {isFilling ? (
              <span className="flex items-center gap-1.5 text-[9px] font-bold text-amber-400
                               bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-500/40">
                <Loader2 className="animate-spin" size={10} />
                {standings.length}/14
              </span>
            ) : instanceData?.start_time && new Date(instanceData.start_time) > new Date() ? (
              <span className="flex items-center gap-1.5 text-[9px] font-bold text-pink-400
                               bg-pink-900/20 px-2.5 py-1 rounded-full border border-pink-500/40 uppercase">
                Transfer Window
              </span>
            ) : null}
          </div>

          {/* User's position highlight */}
          {userRank > 0 && (
            <div className="flex items-center gap-3 mt-2 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">Your Position</span>
                <span className="text-xl font-black font-orbitron text-white">#{userRank}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                {userRank <= 3
                  ? <TrendingUp size={14} className="text-emerald-400" />
                  : userRank >= 12
                  ? <TrendingDown size={14} className="text-red-400" />
                  : <div className="w-3.5 h-0.5 bg-gray-600 rounded-full" />
                }
                <span className={`text-[9px] font-bold uppercase tracking-widest ${
                  userRank <= 3 ? 'text-emerald-400' : userRank >= 12 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {userRank <= 3 ? 'Promotion Zone' : userRank >= 12 ? 'Relegation Zone' : 'Mid-Table'}
                </span>
              </div>
              <div className="ml-auto">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-600" />
                  <span className="text-[9px] text-gray-500">{standings.length} teams</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Standings Table ─────────────────────────────────────────── */}
      <section className="relative z-10 p-4 pt-3">
        <div className="glass-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_40px_56px_40px] bg-white/5 border-b border-white/5 px-3 py-2.5">
            <div className="text-[9px] text-gray-600 uppercase font-bold font-orbitron text-center">#</div>
            <div className="text-[9px] text-gray-600 uppercase font-bold font-orbitron">Club</div>
            <div className="text-[9px] text-gray-600 uppercase font-bold font-orbitron text-center">W‑D‑L</div>
            <div className="text-[9px] text-gray-500 uppercase font-bold font-orbitron text-center">GF·GA</div>
            <div className="text-[9px] text-white uppercase font-black font-orbitron text-center">PTS</div>
          </div>

          {/* Rows */}
          {standings.length > 0 ? standings.map((row, index) => {
            const isCurrentUser = row.team_id === team.id;
            const rank = index + 1;
            const isPromotion = rank <= 3;
            const isRelegation = rank >= 12;
            const gd = (row.goals_for || 0) - (row.goals_against || 0);

            return (
              <div
                key={row.id}
                className={`grid grid-cols-[32px_1fr_40px_56px_40px] px-3 py-2.5 items-center
                            border-b border-white/[0.04] relative
                            ${isCurrentUser
                              ? 'bg-violet-500/8 border-l-2 border-l-violet-500'
                              : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                            }
                            ${isPromotion && !isCurrentUser ? 'border-l-emerald-500/50' : ''}
                            ${isRelegation && !isCurrentUser ? 'border-l-red-500/50' : ''}
                `}
              >
                {/* Rank */}
                <div className="text-center">
                  {rank === 1 ? (
                    <Medal className="text-yellow-400 mx-auto" size={16} />
                  ) : rank === 2 ? (
                    <Medal className="text-gray-400 mx-auto" size={16} />
                  ) : rank === 3 ? (
                    <Medal className="text-orange-500 mx-auto" size={16} />
                  ) : (
                    <span className="text-[11px] text-gray-600 font-mono">{rank}</span>
                  )}
                </div>

                {/* Club name */}
                <div className={`flex items-center gap-1.5 min-w-0 ${isCurrentUser ? 'text-violet-300' : 'text-white'}`}>
                  <span className="text-xs font-bold truncate max-w-[110px]">
                    {row.teams?.name || 'Unknown'}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[8px] bg-violet-500 text-white font-black px-1.5 py-0.5 rounded-full
                                     uppercase tracking-wider flex-shrink-0">
                      YOU
                    </span>
                  )}
                </div>

                {/* W-D-L combined */}
                <div className="text-center">
                  <span className="text-[10px] font-mono font-bold text-gray-400">
                    <span className="text-emerald-400">{row.wins}</span>
                    <span className="text-gray-700">-</span>
                    <span className="text-gray-400">{row.draws}</span>
                    <span className="text-gray-700">-</span>
                    <span className="text-red-400">{row.losses}</span>
                  </span>
                </div>

                {/* GF·GA */}
                <div className="text-center">
                  <span className="text-[10px] font-mono text-gray-500">
                    <span className="text-emerald-400/80">{row.goals_for || 0}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-red-400/80">{row.goals_against || 0}</span>
                  </span>
                </div>

                {/* Points */}
                <div className={`text-center text-sm font-black font-orbitron ${
                  isCurrentUser ? 'text-violet-300 neon-text-violet' : 'text-white'
                }`}>
                  {row.points}
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <Target className="mb-3 opacity-40" size={32} />
              <p className="font-bold text-sm text-violet-400/60">League is empty.</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/50 border border-emerald-500/70" />
            <span className="text-[8px] text-gray-600 uppercase tracking-widest">Promotion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/50 border border-red-500/70" />
            <span className="text-[8px] text-gray-600 uppercase tracking-widest">Relegation</span>
          </div>
        </div>
      </section>
    </div>
  );
}
