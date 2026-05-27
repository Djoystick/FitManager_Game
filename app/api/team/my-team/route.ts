import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Missing or invalid user session' }, { status: 401 });
    }

    // 1. Fetch the team metadata for the user securely
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, logo_url, is_ready_for_match, formation')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ success: true, team: null, players: [] }, { status: 200 });
    }

    // 2. Fetch all players (active and coaches) belonging to this team. STRICT FILTER APPLIED.
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, age, ovr, is_nft_coach, traits, position, stats, stamina, lineup_status, lineup_slot')
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
