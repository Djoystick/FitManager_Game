'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { getRandomName } from '@/app/utils/nameGenerator';
import { triggerTransferAchievements } from '@/app/services/achievementService';
import { verifySession } from '@/lib/session';

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const AVAILABLE_TRAITS = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function listPlayerAction(playerId: string, priceTon: number) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'User not authenticated' };
    if (priceTon <= 0 || priceTon > 1000000) return { success: false, error: 'Invalid price. Maximum 1,000,000 TON' };

    const { data, error } = await supabaseAdmin.rpc('list_player_on_market', {
      p_seller_id: userId,
      p_player_id: playerId,
      p_price_ton: priceTon
    });

    if (error) {
      console.error('[MarketActions] listPlayer error:', error);
      return { success: false, error: error.message };
    }

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (team) await triggerTransferAchievements(team.id, 'sell');

    return { success: true, data };
  } catch (err: any) {
    console.error('[MarketActions] Exception in listPlayer:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function buyPlayerAction(listingId: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'User not authenticated' };

    // Anti-cheat: check if buyer and seller played each other in last 48h
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('market_listings')
      .select('seller_id, player_id')
      .eq('id', listingId)
      .eq('status', 'active')
      .single();

    if (listingErr || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    const { data: buyerTeam } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();
    const { data: sellerTeam } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', listing.seller_id)
      .single();

    if (buyerTeam && sellerTeam) {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentMatch } = await supabaseAdmin
        .from('league_matches')
        .select('id')
        .or(`and(home_team_id.eq.${buyerTeam.id},away_team_id.eq.${sellerTeam.id}),and(home_team_id.eq.${sellerTeam.id},away_team_id.eq.${buyerTeam.id})`)
        .eq('is_played', true)
        .gte('created_at', cutoff)
        .limit(1)
        .maybeSingle();

      if (recentMatch) {
        return {
          success: false,
          error: 'Purchase forbidden: you played against this manager recently',
          errorKey: 'anticheat_recent_match',
          errorRu: 'Покупка запрещена: вы играли с этим менеджером недавно',
        };
      }
    }

    // P0-2 FIX: Economic lockout — cannot buy players while bankrupt
    const { data: buyerUser } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .maybeSingle();
    if ((buyerUser?.balance_fancoins ?? 1) === 0) {
      return {
        success: false,
        error: 'Cannot buy players while bankrupt. Win a match to recover.',
        errorKey: 'bankrupt_lockout',
        errorRu: 'Нельзя покупать игроков будучи банкротом. Выиграйте матч, чтобы восстановиться.',
      };
    }

    const { data, error } = await supabaseAdmin.rpc('buy_player_from_market', {
      p_buyer_id: userId,
      p_listing_id: listingId
    });

    if (error) {
      console.error('[MarketActions] buyPlayer error:', error);
      return { success: false, error: error.message };
    }

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (team) await triggerTransferAchievements(team.id, 'buy');

    // Send transfer notification to seller
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('name')
      .eq('id', listing.player_id)
      .single();
    const playerName = player?.name ?? 'Player';
    const { data: listingData } = await supabaseAdmin
      .from('market_listings')
      .select('price_ton')
      .eq('id', listingId)
      .single();
    const price = listingData?.price_ton ?? 0;

    await supabaseAdmin.from('personal_notifications').insert({
      user_id: listing.seller_id,
      type: 'transfer',
      title: 'Player sold',
      message: JSON.stringify({
        en: `Your player ${playerName} was sold for ${price} TON.`,
        ru: `Ваш игрок ${playerName} продан за ${price} TON.`,
      }),
    });

    return { success: true, data };
  } catch (err: any) {
    console.error('[MarketActions] Exception in buyPlayer:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function cancelListingAction(listingId: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
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
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: 'Available only in development mode' };
    }

    const cookieStore = await cookies();
    const userId = (await verifySession());
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

// ==========================================
// FREE AGENTS MARKET LOGIC (Phase 1)
// ==========================================

/**
 * Generates 5 procedural bots and signs their payload.
 */
export async function getFreeAgentsAction() {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'User not authenticated' };

    const jwtSecret = process.env.CRON_SECRET;
    if (!jwtSecret) throw new Error("CRON_SECRET is not configured");

    const freeAgents = [];
    for (let i = 0; i < 5; i++) {
      // 1. Generate Stats
      const pace = getRandomInt(40, 65);
      const shooting = getRandomInt(40, 65);
      const passing = getRandomInt(40, 65);
      const defending = getRandomInt(40, 65);
      const physical = getRandomInt(40, 65);
      
      const ovr = Math.floor((pace + shooting + passing + defending + physical) / 5);
      // Hard cap at 62 OVR
      const finalOvr = Math.min(62, ovr);
      const age = getRandomInt(18, 25);
      const name = getRandomName();

      const positions = ['GK', 'DEF', 'MID', 'FWD'];
      const position = positions[getRandomInt(0, 3)];

      // 2. Generate Traits
      const traitsRoll = Math.random();
      let numTraits = 0;
      if (traitsRoll >= 0.90) numTraits = 2;
      else if (traitsRoll >= 0.40) numTraits = 1;

      const traits: string[] = [];
      const available = [...AVAILABLE_TRAITS];
      for (let j = 0; j < numTraits; j++) {
        const idx = getRandomInt(0, available.length - 1);
        traits.push(available.splice(idx, 1)[0]);
      }

      // 3. Calculate FC Price: 50 * (1.10 ^ OVR)
      const priceFc = Math.floor(50 * Math.pow(1.10, finalOvr));

      const botPayload = {
        id: `bot_${Date.now()}_${i}`,
        name,
        age,
        ovr: finalOvr,
        position,
        traits,
        stats: { pace, shooting, passing, defending, physical },
        priceFc
      };

      // Sign the payload so client can't tamper with price/stats
      const token = jwt.sign(botPayload, jwtSecret, { expiresIn: '1h' });

      freeAgents.push({ ...botPayload, token });
    }

    return { success: true, data: freeAgents };

  } catch (err: any) {
    console.error('[MarketActions] getFreeAgentsAction error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Buys a procedurally generated Free Agent
 */
export async function buyFreeAgentAction(token: string) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'User not authenticated' };

    const jwtSecret = process.env.CRON_SECRET;
    if (!jwtSecret) throw new Error("CRON_SECRET is not configured");

    // 1. Verify token
    let decodedBot;
    try {
      decodedBot = jwt.verify(token, jwtSecret) as any;
    } catch (e) {
      return { success: false, error: 'Invalid or expired Free Agent contract.' };
    }

    // 2. Fetch User & Team
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .single();
      
    if (userErr || !user) return { success: false, error: 'User not found' };

    if ((user.balance_fancoins || 0) < decodedBot.priceFc) {
      return { success: false, error: `Insufficient FanCoins. Need ${decodedBot.priceFc} FC.` };
    }

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !team) return { success: false, error: 'Team not found' };

    // 3. Check for unique name in DB
    const { data: existingName } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('name', decodedBot.name)
      .maybeSingle();

    if (existingName) {
      // If name is taken, append initials
      decodedBot.name = `${decodedBot.name} ${String.fromCharCode(65 + getRandomInt(0, 25))}.`;
    }

    // 4. Deduct FC atomically via RPC
    const { data: newBalance, error: deductErr } = await supabaseAdmin.rpc('deduct_fancoins', {
      user_id: userId,
      amount: decodedBot.priceFc,
    });

    if (deductErr) return { success: false, error: 'Insufficient FanCoins or payment failed' };

    // 5. Create Player
    const playerToInsert = {
      team_id: team.id,
      name: decodedBot.name,
      age: decodedBot.age,
      ovr: decodedBot.ovr,
      position: decodedBot.position,
      traits: decodedBot.traits,
      stats: decodedBot.stats,
      stamina: 100,
      potential_limit: getRandomInt(decodedBot.ovr + 5, 90),
      is_nft_coach: false,
      lineup_status: 'bench' // Bought players go to bench
    };

    const { data: newPlayer, error: insertErr } = await supabaseAdmin
      .from('players')
      .insert(playerToInsert)
      .select()
      .single();

    if (insertErr) {
      // Refund FC if insertion fails
      await supabaseAdmin.rpc('increment_fancoins', { u_id: userId, amount: decodedBot.priceFc });
      return { success: false, error: 'Failed to recruit player' };
    }

    await triggerTransferAchievements(team.id, 'buy');

    return { success: true, player: newPlayer };

  } catch (err: any) {
    console.error('[MarketActions] buyFreeAgentAction error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

