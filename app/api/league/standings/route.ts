import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let userTeamId = null;
    let targetLeagueId = null;

    // 1. Find the current user's team ID and their league instance
    if (userId) {
       const { data: teamData } = await supabase.from('teams').select('id').eq('user_id', userId).single();
       if (teamData) {
         userTeamId = teamData.id;
         const { data: userStanding } = await supabase.from('league_standings')
           .select('league_instance_id')
           .eq('team_id', userTeamId)
           .single();
         if (userStanding) {
           targetLeagueId = userStanding.league_instance_id;
         }
       }
    }

    // If we couldn't find a target league (user has no team or is not in a league yet),
    // we can either return empty or a default league. We'll return empty for safety.
    if (!targetLeagueId) {
       return NextResponse.json({
         success: true,
         standings: [],
         recentMatches: [],
         userTeamId,
         league_instance: null
       });
    }

    // 2. Fetch Standings ONLY for the target league
    const { data: standingsData, error: standingsError } = await supabase
      .from('league_standings')
      .select('*, team:teams(name), league_instance:league_instances(tier_level)')
      .eq('league_instance_id', targetLeagueId)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('matches_played', { ascending: true });

    if (standingsError) {
      console.error("League Standings Fetch Error:", standingsError);
      return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
    }

    // Map to include team_name directly to preserve frontend compatibility
    const standings = standingsData?.map(s => ({
      ...s,
      team_name: (s.team as any)?.name || 'Unknown'
    })) || [];

    // 3. Fetch Recent Match History ONLY for the target league
    const { data: matches, error: matchesError } = await supabase
      .from('league_matches')
      .select(`
        id, 
        home_score, 
        away_score, 
        created_at,
        home_team:teams!league_matches_home_team_id_fkey (id, name),
        away_team:teams!league_matches_away_team_id_fkey (id, name)
      `)
      .eq('league_instance_id', targetLeagueId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (matchesError) {
      console.error("Match History Fetch Error:", matchesError);
    }

    return NextResponse.json({
      success: true,
      standings: standings || [],
      recentMatches: matches || [],
      userTeamId,
      league_instance: standingsData?.[0]?.league_instance || null
    });

  } catch (error: any) {
    console.error("League API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
