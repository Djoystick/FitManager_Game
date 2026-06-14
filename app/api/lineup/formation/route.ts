import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { verifySession } from '@/lib/session';

export async function PUT(req: Request) {
  try {
    const { formation } = await req.json();

    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedFormations = ['4-4-2', '4-3-3', '3-5-2'];
    if (!allowedFormations.includes(formation)) {
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

    // 2. Execute team formation update
    const { error: teamUpdateError } = await supabase
      .from('teams')
      .update({ formation })
      .eq('id', team.id);

    if (teamUpdateError) {
      return NextResponse.json({ error: 'Failed to update formation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Formation updated to ${formation}` });

  } catch (error: any) {
    console.error("Formation Update API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
