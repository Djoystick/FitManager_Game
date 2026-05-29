'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function listPlayerAction(playerId: string, priceTon: number) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabaseAdmin.rpc('list_player_on_market', {
      p_seller_id: userId,
      p_player_id: playerId,
      p_price_ton: priceTon
    });

    if (error) {
      console.error('[MarketActions] listPlayer error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[MarketActions] Exception in listPlayer:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function buyPlayerAction(listingId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabaseAdmin.rpc('buy_player_from_market', {
      p_buyer_id: userId,
      p_listing_id: listingId
    });

    if (error) {
      console.error('[MarketActions] buyPlayer error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[MarketActions] Exception in buyPlayer:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function cancelListingAction(listingId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabaseAdmin.rpc('cancel_market_listing', {
      p_seller_id: userId,
      p_listing_id: listingId
    });

    if (error) {
      console.error('[MarketActions] cancelListing error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[MarketActions] Exception in cancelListing:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function getMarketListingsAction(filters?: { minOvr?: number, position?: string, maxPrice?: number }) {
  try {
    let query = supabaseAdmin
      .from('market_listings')
      .select(`
        id,
        price_ton,
        created_at,
        seller:seller_id ( id ),
        player:player_id ( id, name, position, age, ovr, traits, seasons_played )
      `)
      .eq('status', 'active');

    // Due to Supabase/PostgREST nested filtering limitations, it is often simpler 
    // to filter basic attributes if they are exposed, or filter on the client.
    // We will do basic ordering here.
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[MarketActions] getListings error:', error);
      return { success: false, error: error.message };
    }

    // Apply manual filters for nested data if necessary
    let filteredData = data;
    if (filters) {
      if (filters.minOvr) {
        filteredData = filteredData.filter((l: any) => l.player && l.player.ovr >= filters.minOvr!);
      }
      if (filters.position && filters.position !== 'ALL') {
        filteredData = filteredData.filter((l: any) => l.player && l.player.position === filters.position);
      }
      if (filters.maxPrice) {
        filteredData = filteredData.filter((l: any) => parseFloat(l.price_ton) <= filters.maxPrice!);
      }
    }

    return { success: true, data: filteredData };
  } catch (err: any) {
    console.error('[MarketActions] Exception in getListings:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function debugAddTonAction(amount: number) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('balance_ton')
      .eq('id', userId)
      .single();

    if (userErr) return { success: false, error: userErr.message };

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ balance_ton: (user.balance_ton || 0) + amount })
      .eq('id', userId);

    if (updateErr) return { success: false, error: updateErr.message };

    return { success: true };
  } catch (err: any) {
    console.error('[MarketActions] Exception in debugAddTonAction:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
