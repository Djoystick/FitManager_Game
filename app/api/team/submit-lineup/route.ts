import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export interface SubmitLineupRequest {
  teamId: string;
}

const LEAGUE_OVR_CAP = 80;
const TAX_RATE_PER_OVR = 50;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Missing valid session' }, { status: 401 });
    }

    const body: Partial<SubmitLineupRequest> = await req.json();
    const { teamId } = body;

    // 1. Validation
    if (!teamId) {
      return NextResponse.json(
        { error: 'Missing required payload field: teamId' },
        { status: 400 }
      );
    }

    // 2. Ownership Verification
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (teamError || !teamData) {
      return NextResponse.json(
        { error: 'Team not found or database read error' },
        { status: 404 }
      );
    }

    if (teamData.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this team' },
        { status: 403 }
      );
    }

    // 3. Compute Team Average OVR
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('ovr')
      .eq('team_id', teamId);

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    let averageOvr = 50; // fallback base
    if (players && players.length > 0) {
      const sum = players.reduce((acc, p) => acc + p.ovr, 0);
      averageOvr = Math.round(sum / players.length);
    }

    // 4. Calculate Luxury Tax Penalty
    const tax = Math.max(0, (averageOvr - LEAGUE_OVR_CAP) * TAX_RATE_PER_OVR);

    // 5. Verify Balance and Execute Simulated Transaction
    if (tax > 0) {
      // Fetch user's current FanCoin wallet balance
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('balance_fancoins')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { error: 'User not found during economic validation' },
          { status: 404 }
        );
      }

      const currentBalance = Number(user.balance_fancoins) || 0;

      if (currentBalance < tax) {
        return NextResponse.json(
          { error: `Insufficient FanCoins to pay Luxury Tax. Required: ${tax}, Balance: ${currentBalance}` },
          { status: 400 }
        );
      }

      const newBalance = currentBalance - tax;

      // Preemptively deduct the tax (Step 1 of atomic flow)
      const { error: deductError } = await supabase
        .from('users')
        .update({ balance_fancoins: newBalance })
        .eq('id', userId);

      if (deductError) {
        throw new Error(`Failed to process Luxury Tax deduction: ${deductError.message}`);
      }

      // Flag the team as ready (Step 2 of atomic flow)
      const { error: readyError } = await supabase
        .from('teams')
        .update({ is_ready_for_match: true })
        .eq('id', teamId);

      if (readyError) {
        // Rollback: Refund the tax if marking the team fails
        console.error("Failed to mark team as ready. Initiating tax rollback...", readyError);
        await supabase
          .from('users')
          .update({ balance_fancoins: currentBalance })
          .eq('id', userId);
          
        throw new Error(`Failed to submit lineup state: ${readyError.message}. FanCoin tax refunded securely.`);
      }

    } else {
      // No tax due, bypass economic burn and simply mark state as ready
      const { error: readyError } = await supabase
        .from('teams')
        .update({ is_ready_for_match: true })
        .eq('id', teamId);

      if (readyError) {
        throw new Error(`Failed to submit lineup state: ${readyError.message}`);
      }
    }

    // 6. Return formatting Response
    return NextResponse.json({
      success: true,
      averageOvr,
      taxPaid: tax,
      message: tax > 0 ? `Lineup submitted. Paid ${tax} FanCoins in Luxury Tax.` : 'Lineup submitted securely. No Luxury Tax due.',
    });

  } catch (error: any) {
    console.error("Submit Lineup API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
