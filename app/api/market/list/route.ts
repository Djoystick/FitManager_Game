import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface MarketListRequest {
  playerId: string;
  priceTon: number;
}

const LISTING_FEE_FANCOINS = 100;

export async function POST(req: Request) {
  try {
    const body: Partial<MarketListRequest> = await req.json();
    const { playerId, priceTon } = body;

    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Payload Verification
    if (!playerId || priceTon === undefined || priceTon <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid payload fields: playerId or priceTon' },
        { status: 400 }
      );
    }

    // 2. Verify Player Ownership
    // Extract the team_id for the player
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('id', playerId)
      .single();

    if (playerError || !playerData) {
      return NextResponse.json(
        { error: 'Player not found or database read error' },
        { status: 404 }
      );
    }

    // Verify the team belongs to the requesting user
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', playerData.team_id)
      .single();

    if (teamError || !teamData || teamData.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own the team this player belongs to' },
        { status: 403 }
      );
    }

    // 3. Spam Defense: Check for existing active listing
    const { data: existingListing } = await supabase
      .from('transfer_market')
      .select('id')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .single();

    if (existingListing) {
      return NextResponse.json(
        { error: 'Conflict: This player is already listed actively on the market' },
        { status: 409 }
      );
    }

    // 4. Economic Verification & Burn via atomic RPC
    const { error: deductError } = await supabaseAdmin.rpc('deduct_fancoins', {
      user_id: userId,
      amount: LISTING_FEE_FANCOINS,
    });

    if (deductError) {
      return NextResponse.json(
        { error: `Insufficient FanCoins. Required listing fee: ${LISTING_FEE_FANCOINS} FC` },
        { status: 400 }
      );
    }

    // 5. Insert Market Listing
    const { data: marketListing, error: marketError } = await supabaseAdmin
      .from('transfer_market')
      .insert({
        player_id: playerId,
        seller_id: userId,
        price_ton: priceTon,
        is_active: true,
      })
      .select('id')
      .single();

    if (marketError) {
      // Rollback: Refund the listing fee
      console.error("Market insert failed, initiating rollback...", marketError);
      await supabaseAdmin.rpc('increment_fancoins', { u_id: userId, amount: LISTING_FEE_FANCOINS });
      throw new Error(`Failed to create market listing: ${marketError.message}. FanCoins refunded.`);
    }

    // 6. Return Success
    return NextResponse.json({
      success: true,
      listing_id: marketListing.id,
    });

  } catch (error: any) {
    console.error("Market Listing API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
