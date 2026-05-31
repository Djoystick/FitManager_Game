import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/matches/recent?teamId=<uuid>&limit=<n>
// Returns the last N played matches for a team, enriched with team names.
// Used by the Dashboard horizontal match history carousel.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '10', 10), 30);

  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  try {
    const { data: matches, error } = await supabaseAdmin
      .from('league_matches')
      .select(`
        id,
        round_number,
        home_score,
        away_score,
        is_played,
        events,
        home_team:teams!league_matches_home_team_id_fkey(id, name, logo_url),
        away_team:teams!league_matches_away_team_id_fkey(id, name, logo_url)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('is_played', true)
      .order('round_number', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/matches/recent] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ matches: matches || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
