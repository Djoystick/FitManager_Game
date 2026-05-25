import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(req: Request) {
  try {
    const { userId, formation } = await req.json();

    const allowedFormations = ['4-4-2', '4-3-3', '3-5-2'];
    if (!userId || !allowedFormations.includes(formation)) {
      return NextResponse.json({ error: 'Invalid parameters or formation' }, { status: 400 });
    }

    // 1. Fetch Team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, is_ready_for_match')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 2. Fetch all active players
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, position, ovr')
      .eq('team_id', team.id)
      .eq('is_nft_coach', false);

    if (playersError || !allPlayers) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    // 3. Auto-Adjustment Logic
    const playersToUpdate = allPlayers.map(p => ({ ...p, lineup_status: 'bench', lineup_slot: null as string | null }));

    const reqs: Record<string, { GK: number, DEF: number, MID: number, FWD: number }> = {
      '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
      '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
      '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
    };

    const targetReqs = reqs[formation];

    const setStarting = (pos: string, count: number) => {
      const available = playersToUpdate
        .filter(p => p.position === pos)
        .sort((a, b) => b.ovr - a.ovr); // Sort descending OVR

      for (let i = 0; i < Math.min(count, available.length); i++) {
        available[i].lineup_status = 'starting';
        available[i].lineup_slot = `${pos}_${i + 1}`;
      }
    };

    setStarting('GK', targetReqs.GK);
    setStarting('DEF', targetReqs.DEF);
    setStarting('MID', targetReqs.MID);
    setStarting('FWD', targetReqs.FWD);

    // 4. Execute updates
    const { error: teamUpdateError } = await supabase
      .from('teams')
      .update({ formation })
      .eq('id', team.id);

    if (teamUpdateError) {
      return NextResponse.json({ error: 'Failed to update formation' }, { status: 500 });
    }

    // Prepare JSONB payload for bulk RPC
    const payload = playersToUpdate.map(p => ({
      id: p.id,
      lineup_status: p.lineup_status,
      lineup_slot: p.lineup_slot
    }));

    // Execute single bulk operation via RPC to prevent connection pool exhaustion
    const { error: bulkError } = await supabase.rpc('bulk_update_lineup', { payload });

    if (bulkError) {
      console.error("Bulk Update RPC Error:", bulkError);
      return NextResponse.json({ error: 'Failed to bulk update roster' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Formation updated to ${formation}` });

  } catch (error: any) {
    console.error("Formation Update API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
