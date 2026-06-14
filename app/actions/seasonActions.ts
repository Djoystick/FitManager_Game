'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getLastSeasonResult() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: teamData } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).maybeSingle();
    if (!teamData) return { success: false, error: 'Team not found' };
    const teamId = teamData.id;

    // 1. Find the latest 'finished' league instance this team participated in
    const { data: standings } = await supabaseAdmin
      .from('league_standings')
      .select('league_instance_id, league_instances!inner(status, tier_level, created_at)')
      .eq('team_id', teamId)
      .eq('league_instances.status', 'finished')
      .order('league_instances(created_at)', { ascending: false })
      .limit(1);

    if (!standings || standings.length === 0) {
      return { success: false, error: 'No finished seasons found' };
    }

    const lastInstanceId = standings[0].league_instance_id;
    // @ts-ignore
    const tierLevel = standings[0].league_instances.tier_level;

    // 2. Fetch all standings for that instance to calculate rank
    const { data: allStandings, error } = await supabaseAdmin
      .from('league_standings')
      .select('team_id, points, wins, matches_played, goals_for')
      .eq('league_instance_id', lastInstanceId)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('goals_for', { ascending: false })
      .order('matches_played', { ascending: true });

    if (error || !allStandings) {
      return { success: false, error: 'Failed to calculate rank' };
    }

    const rankIndex = allStandings.findIndex(s => s.team_id === teamId);
    if (rankIndex === -1) {
      return { success: false, error: 'Team not found in standings' };
    }

    const rank = rankIndex + 1;
    const totalTeams = allStandings.length;

    const isChampion = rank === 1;
    const isPromoted = rank <= 3 && tierLevel > 1;
    const isRelegated = rank >= totalTeams - 2 && tierLevel < 10;

    return {
      success: true,
      data: {
        rank,
        tierLevel,
        isChampion,
        isPromoted,
        isRelegated,
        points: allStandings[rankIndex].points,
      }
    };
  } catch (error: any) {
    console.error('Error fetching last season result:', error);
    return { success: false, error: error.message };
  }
}
