import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SubmitLineupRequest {
  teamId: string;
}

const LEAGUE_OVR_CAP = 80;
const TAX_RATE_PER_OVR = 50;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());

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
      // Deduct tax via atomic RPC
      const { error: deductError } = await supabaseAdmin.rpc('deduct_fancoins', {
        user_id: userId,
        amount: tax,
      });

      if (deductError) {
        return NextResponse.json(
          { error: `Insufficient FanCoins to pay Luxury Tax (required: ${tax})` },
          { status: 400 }
        );
      }

      // Flag the team as ready
      const { error: readyError } = await supabaseAdmin
        .from('teams')
        .update({ is_ready_for_match: true })
        .eq('id', teamId);

      if (readyError) {
        // Rollback: Refund the tax if marking the team fails
        console.error("Failed to mark team as ready. Initiating tax rollback...", readyError);
        await supabaseAdmin.rpc('increment_fancoins', { u_id: userId, amount: tax });
        throw new Error(`Failed to submit lineup state: ${readyError.message}. FanCoin tax refunded.`);
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
