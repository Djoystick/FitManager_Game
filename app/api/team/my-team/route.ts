import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Missing or invalid user session' }, { status: 401 });
    }

    // 1. Fetch the team metadata for the user securely
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, name, logo_url, is_ready_for_match, formation')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ success: true, team: null, players: [] }, { status: 200 });
    }

    // 1.5 Fetch instance info
    let instanceStatus = 'active';
    let instanceCreatedAt = null;
    let teamCount = 1;
    
    const { data: standings } = await supabaseAdmin.from('league_standings').select('league_instance_id').eq('team_id', team.id);
    if (standings && standings.length > 0) {
      const instanceId = standings[0].league_instance_id;
      const { data: instance } = await supabaseAdmin.from('league_instances').select('status, created_at').eq('id', instanceId).single();
      if (instance) {
        instanceStatus = instance.status;
        instanceCreatedAt = instance.created_at;
      }
      const { count } = await supabaseAdmin.from('league_standings').select('*', { count: 'exact', head: true }).eq('league_instance_id', instanceId);
      teamCount = count || 1;
    }

    // 2. Fetch all players (active and coaches) belonging to this team. STRICT FILTER APPLIED.
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, name, age, ovr, is_nft_coach, traits, position, stats, stamina, lineup_status, lineup_slot, injury_matches_left, is_for_sale, is_retired, seasons_played')
      .eq('team_id', team.id);

    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    const safePlayers = (players || []).map(p => ({
      ...p,
      age: p.age ?? 18,
      is_for_sale: p.is_for_sale ?? false,
      is_retired: p.is_retired ?? false,
      seasons_played: p.seasons_played ?? 0
    }));

    return NextResponse.json({
      success: true,
      team,
      instanceStatus,
      instanceCreatedAt,
      teamCount,
      players: safePlayers
    });

  } catch (error: any) {
    console.error("My Team API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
