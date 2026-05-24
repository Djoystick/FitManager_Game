import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { userId, playerId } = await req.json();

    if (!userId || !playerId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { error: rpcError } = await supabase.rpc('heal_player_with_tp', {
      u_id: userId,
      p_id: playerId
    });

    if (rpcError) {
      console.error("Heal Player RPC Error:", rpcError);
      return NextResponse.json({ error: rpcError.message || 'Failed to heal player' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Heal Player API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
