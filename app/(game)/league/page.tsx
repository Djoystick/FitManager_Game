import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Medal, Target, Users, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { requireTeam } from '@/lib/authGuard';
import { FriendlyMatchCard } from './FriendlyMatchCard';
import { HubSocialClient } from './HubSocialClient';
import { HubTabsWrapper } from './HubTabsWrapper';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeagueDashboard() {
  const team = await requireTeam();
  if (!team) return null;

  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;
  if (!userId) return null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch friendly match count
  const { data: friendlyLogs } = await supabaseAdmin
    .from('fitness_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('activity_type', 'friendly_match');
  const friendlyMatchesPlayed = friendlyLogs?.length || 0;

  // Fetch user's current league instance
  const { data: userStandings } = await supabaseAdmin
    .from('league_standings')
    .select('league_instance_id, league_instances!inner(status)')
    .eq('team_id', team.id)
    .in('league_instances.status', ['active', 'filling'])
    .limit(1);

  const userStanding = userStandings?.[0];

  if (!userStanding?.league_instance_id) {
    return (
      <div className="flex flex-col flex-1 p-4 gap-6 pb-28 h-full overflow-y-auto custom-scrollbar justify-center items-center text-center"
           style={{ background: '#05060f' }}>
        <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-40" />
        <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mb-2 relative z-10">
          <Trophy className="text-gray-600" size={32} />
        </div>
        <h1 className="text-xl font-bold font-orbitron text-white relative z-10">Unassigned</h1>
        <p className="text-gray-500 text-sm relative z-10">Your team has not been placed in a league instance yet.</p>
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

  const standings = (standingsData ?? []).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = (a.goals_for || 0) - (a.goals_against || 0);
    const diffB = (b.goals_for || 0) - (b.goals_against || 0);
    return diffB - diffA;
  });

  const tierName  = (instanceData?.league_tiers as any)?.name || 'Unknown Tier';
  const groupName = instanceData?.name || 'Unknown Group';
  const isFilling = instanceData?.status === 'filling';
  const isTransferWindow = instanceData?.start_time && new Date(instanceData.start_time) > new Date();
  const userRank  = standings.findIndex(s => s.team_id === team.id) + 1;

  // Pre-build standings table JSX for passing as serializable string
  const standingsProps = {
    standings: standings.map(row => ({
      id:            row.id,
      team_id:       row.team_id,
      team_name:     row.teams?.name || 'Unknown',
      matches_played: row.matches_played ?? 0,
      wins:           row.wins          ?? 0,
      draws:          row.draws         ?? 0,
      losses:         row.losses        ?? 0,
      goals_for:      row.goals_for     ?? 0,
      goals_against:  row.goals_against ?? 0,
      points:         row.points        ?? 0,
    })),
    currentTeamId: team.id,
    tierName,
    groupName,
    isFilling,
    isTransferWindow: !!isTransferWindow,
    userRank,
    totalTeams: standings.length,
    friendlyMatchesPlayed,
    userId,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#05060f' }}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-60" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      {/* HubTabsWrapper handles primary tabs + routing */}
      <HubTabsWrapper {...standingsProps} />
    </div>
  );
}
