import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { verifySession } from '@/lib/session';

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

    // 4. Economic Verification & Burn (Simulated Transaction)
    // Fetch user FanCoin balance
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

    if (currentBalance < LISTING_FEE_FANCOINS) {
      return NextResponse.json(
        { error: `Insufficient FanCoins. Required: ${LISTING_FEE_FANCOINS}, Balance: ${currentBalance}` },
        { status: 400 }
      );
    }

    const newBalance = currentBalance - LISTING_FEE_FANCOINS;

    // Deduct coins preemptively (if market insert fails, we refund via catch block)
    const { error: deductError } = await supabase
      .from('users')
      .update({ balance_fancoins: newBalance })
      .eq('id', userId);

    if (deductError) {
      throw new Error(`Failed to deduct FanCoins: ${deductError.message}`);
    }

    // 5. Insert Market Listing
    const { data: marketListing, error: marketError } = await supabase
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
      // Manual Rollback: Refund FanCoins
      console.error("Market insert failed, initiating rollback...", marketError);
      await supabase
        .from('users')
        .update({ balance_fancoins: currentBalance })
        .eq('id', userId);
        
      throw new Error(`Failed to create market listing: ${marketError.message}. FanCoins successfully refunded.`);
    }

    // 6. Return Success
    return NextResponse.json({
      success: true,
      listing_id: marketListing.id,
      new_balance_fancoins: newBalance,
    });

  } catch (error: any) {
    console.error("Market Listing API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
