import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: teamData } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).maybeSingle();
    if (!teamData) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    const teamId = teamData.id;

    // 1. Fetch latest 10 matches for this user's team
    const { data: matches, error: matchError } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, created_at')
      .eq('status', 'completed')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (matchError) {
      throw new Error(`Failed to fetch matches: ${matchError.message}`);
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, matches: [] });
    }

    // 2. Fetch corresponding team names efficiently
    const teamIds = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]))];
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    if (teamsError) {
      throw new Error(`Failed to fetch team names for journal mapping: ${teamsError.message}`);
    }

    // Create a dictionary for quick lookup
    const teamMap: Record<string, string> = {};
    if (teams) {
      teams.forEach(t => teamMap[t.id] = t.name);
    }

    // 3. Map into the final enriched payload
    const enrichedMatches = matches.map(m => ({
      id: m.id,
      home_score: m.home_score,
      away_score: m.away_score,
      match_date: (m as any).created_at,
      home_team_name: teamMap[m.home_team_id] || 'Unknown Home',
      away_team_name: teamMap[m.away_team_id] || 'Unknown Away',
    }));

    return NextResponse.json({
      success: true,
      matches: enrichedMatches,
    });
  } catch (error: any) {
    console.error("Match History API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
