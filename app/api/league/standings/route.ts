import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // 1. Fetch Standings from the dynamically generated view
    const { data: standings, error: standingsError } = await supabase
      .from('league_standings_view')
      .select('*')
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('matches_played', { ascending: true });

    if (standingsError) {
      console.error("League Standings Fetch Error:", standingsError);
      return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
    }

    // 2. Fetch Recent Match History
    const { data: matches, error: matchesError } = await supabase
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
      userTeamId
    });

  } catch (error: any) {
    console.error("League API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
