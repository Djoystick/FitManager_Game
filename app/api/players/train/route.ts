import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { userId, playerId, statKey } = await req.json();

    if (!userId || !playerId || !['pace', 'shooting', 'passing', 'defending', 'physical'].includes(statKey)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Fetch User, Team, and Infrastructure
    const { data: user } = await supabase.from('users').select('balance_fancoins').eq('id', userId).single();
    const { data: team } = await supabase.from('teams').select('id').eq('user_id', userId).single();
    
    if (!user || !team) {
      return NextResponse.json({ error: 'User or Team not found' }, { status: 404 });
    }

    const { data: infra } = await supabase.from('infrastructure').select('training_camp_level').eq('team_id', team.id).maybeSingle();
    const trainingLevel = infra ? infra.training_camp_level : 1;

    // 2. Fetch Player Data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, team_id, stats, ovr, potential_limit')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.team_id !== team.id) {
      return NextResponse.json({ error: 'Player does not belong to your team' }, { status: 403 });
    }

    // 3. Validation: Check Potential Limit
    if (player.ovr >= player.potential_limit) {
      return NextResponse.json({ error: 'Maximum potential reached' }, { status: 400 });
    }

    // 4. Cost Calculation
    const baseCost = 500;
    // 5% discount per level, max 50% discount
    const discountPercent = Math.min(0.50, trainingLevel * 0.05);
    const cost = Math.floor(baseCost * (1 - discountPercent));

    if (user.balance_fancoins < cost) {
      return NextResponse.json({ error: 'Insufficient FanCoins' }, { status: 400 });
    }

    // 5. Execution: Deduct FanCoins and Update JSONB Stats Atomically via RPC
    const { error: rpcError } = await supabase.rpc('train_player', { 
      p_id: playerId, 
      u_id: userId, 
      stat_key: statKey, 
      cost: cost 
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return NextResponse.json({ error: 'Failed to process transaction securely' }, { status: 500 });
    }

    // 6. Fetch the newly updated player state to return to the client
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (updateError || !updatedPlayer) {
      return NextResponse.json({ error: 'Failed to fetch updated player stats' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      player: updatedPlayer,
      cost,
      newBalance: user.balance_fancoins - cost
    });

  } catch (error: any) {
    console.error("Player Training API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
