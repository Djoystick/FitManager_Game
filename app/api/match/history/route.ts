import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Fetch latest 10 matches
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, match_date')
      .order('match_date', { ascending: false })
      .limit(10);

    if (matchError) {
      throw new Error(`Failed to fetch matches: ${matchError.message}`);
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, matches: [] });
    }

    // 2. Fetch corresponding team names efficiently
    const teamIds = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]))];
    const { data: teams, error: teamsError } = await supabase
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
      match_date: m.match_date,
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
