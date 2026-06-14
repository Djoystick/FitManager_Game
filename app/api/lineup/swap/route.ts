import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { verifySession } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const { playerOutId, playerInId } = await req.json();

    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!playerOutId || !playerInId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Verify user's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, is_ready_for_match')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.is_ready_for_match) {
      return NextResponse.json({ error: 'Cannot swap players while lineup is locked for a match' }, { status: 400 });
    }

    // 2. Fetch both players to verify ownership and current status
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, team_id, lineup_status, position')
      .in('id', [playerOutId, playerInId]);

    if (playersError || !players || players.length !== 2) {
      return NextResponse.json({ error: 'Players not found or invalid selection' }, { status: 404 });
    }

    // Check ownership
    if (players[0].team_id !== team.id || players[1].team_id !== team.id) {
      return NextResponse.json({ error: 'Players do not belong to your franchise' }, { status: 403 });
    }

    const playerOut = players.find(p => p.id === playerOutId);
    const playerIn = players.find(p => p.id === playerInId);

    if (!playerOut || !playerIn) {
      return NextResponse.json({ error: 'Invalid player IDs' }, { status: 400 });
    }

    // Basic constraint: One must be starting, one must be bench
    if (playerOut.lineup_status === playerIn.lineup_status) {
      return NextResponse.json({ error: 'Players must have different lineup statuses to swap' }, { status: 400 });
    }

    // (Optional) Enforce strict positional swapping. For MVP, we can let users swap any position, 
    // but the prompt says: "handle edge cases gracefully (e.g. prevent swapping GK for FWD if you want strict positional logic...)"
    // Let's enforce strict position matching for simplicity so formation remains strictly 4-4-2.
    if (playerOut.position !== playerIn.position) {
      return NextResponse.json({ error: `Cannot swap a ${playerOut.position} with a ${playerIn.position}. Positions must match.` }, { status: 400 });
    }

    // 3. Perform the swap via two updates (for MVP without RPC)
    const { error: update1Error } = await supabase
      .from('players')
      .update({ lineup_status: playerIn.lineup_status })
      .eq('id', playerOut.id);

    const { error: update2Error } = await supabase
      .from('players')
      .update({ lineup_status: playerOut.lineup_status })
      .eq('id', playerIn.id);

    if (update1Error || update2Error) {
      return NextResponse.json({ error: 'Failed to execute swap in database' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Swap successful' });

  } catch (error: any) {
    console.error("Lineup Swap API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
