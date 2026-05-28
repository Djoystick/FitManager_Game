import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { userId, steps, timezoneDate } = await req.json();

    if (!userId || typeof steps !== 'number' || steps <= 0 || !timezoneDate) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Call the sync_daily_steps RPC (handles SP credit + daily cap internally)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('sync_daily_steps', {
      u_id:         userId,
      steps_to_add: Math.floor(steps),
      today_date:   timezoneDate, // Expected format: 'YYYY-MM-DD'
    });

    if (rpcError) {
      console.error('Sync API RPC Error:', rpcError);
      return NextResponse.json({ error: 'Failed to sync steps' }, { status: 500 });
    }

    // Fetch updated user state for the client (SP + step count, no TP)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('sweat_points, daily_steps_logged')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Failed to retrieve updated state' }, { status: 500 });
    }

    return NextResponse.json({
      success:            true,
      earned_sp:          rpcResult,
      balance_sp:         user.sweat_points,
      daily_steps_logged: user.daily_steps_logged,
      limit_reached:      user.daily_steps_logged >= 20000,
    });

  } catch (error: any) {
    console.error('Fitness Sync API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
