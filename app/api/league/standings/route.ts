import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // 1. Fetch Standings from the physical table
    const { data: standingsData, error: standingsError } = await supabase
      .from('league_standings')
      .select('*, team:teams(name), league_instance:league_instances(tier_level)')
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

    // 2. Fetch Recent Match History
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
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (matchesError) {
      console.error("Match History Fetch Error:", matchesError);
    }

    // 3. Find the current user's team ID if userId is provided
    let userTeamId = null;
    if (userId) {
       const { data: teamData } = await supabase.from('teams').select('id').eq('user_id', userId).single();
       if (teamData) userTeamId = teamData.id;
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
