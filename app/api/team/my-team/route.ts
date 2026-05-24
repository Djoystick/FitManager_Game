import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    // 1. Fetch the team metadata for the user
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, logo_url, is_ready_for_match')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ success: true, team: null, players: [] }, { status: 200 });
    }

    // 2. Fetch all players (active and coaches) belonging to this team
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, age, ovr, is_nft_coach, perks, position, stats, stamina, lineup_status')
      .eq('team_id', team.id);

    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      team,
      players: players || []
    });

  } catch (error: any) {
    console.error("My Team API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
