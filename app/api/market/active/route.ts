import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: listings, error } = await supabase
      .from('transfer_market')
      .select(`
        id,
        price_ton,
        created_at,
        seller_id,
        players (
          id,
          name,
          age,
          ovr,
          perks
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active market listings: ${error.message}`);
    }

    // Map the Supabase relationship response into a cleaner structure for the UI
    const formattedListings = (listings || []).map(item => {
      // Supabase relationships return an object if 1:1, or array for 1:N. Our schema is N:1 from market to players, so it's generally an object.
      const playerObj = Array.isArray(item.players) ? item.players[0] : item.players;
      return {
        id: item.id,
        price_ton: item.price_ton,
        created_at: item.created_at,
        seller_id: item.seller_id,
        player: playerObj,
      };
    }).filter(item => item.player); // Defensively filter anomalies

    return NextResponse.json({
      success: true,
      listings: formattedListings,
    });
  } catch (error: any) {
    console.error("Active Market API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
