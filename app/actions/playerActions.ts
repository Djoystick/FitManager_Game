'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: read authenticated userId from server-side cookie
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return (await verifySession()) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: bulkTrainPlayer was removed in this cleanup pass.
//
//  ALL training now goes through batchTrainPlayerAction (trainingActions.ts),
//  which uses the W2E coin system, progressive costs, and writes
//  progression_history for the PROGRESSION graph.
//
//  The old function used FanCoins and a flat 500 FC/stat cost — it was
//  economically broken and no longer called from any UI component.
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// getPlayerProfileData
//
// Returns full player row including progression_history for the Modal.
// Verifies the player belongs to the requesting user's team.
// ─────────────────────────────────────────────────────────────────────────────

export async function getPlayerProfileData(
  playerId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found.' };

    const { data: player, error } = await supabaseAdmin
      .from('players')
      .select('id, name, age, ovr, potential_limit, position, stats, stamina, traits, is_injured, injury_matches_left, lineup_status, is_for_sale, is_retired, seasons_played, progression_history, perks')
      .eq('id', playerId)
      .eq('team_id', team.id)   // ownership check — cannot fetch another team's player
      .single();

    if (error || !player) return { success: false, error: 'Player not found or access denied.' };

    return { success: true, data: player };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to fetch player profile.' };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// retirePlayer — Hall of Fame mechanic
//
// Permanently retires a legend card (OVR ≥ 85) from the active roster.
// In exchange the user earns a permanent global prestige_multiplier buff
// (+0.02 per legend) that compounds on all future FanCoin rewards.
//
// SECURITY FIX (00045): userId is now read from tg_user_id cookie,
// NOT from the client payload. This closes the privilege escalation
// where any client could pass an arbitrary userId to retire another
// user's player.
// ─────────────────────────────────────────────────────────────────────────────

export async function retirePlayer(
  playerId: string
): Promise<{ success: boolean; newMultiplier?: number; error?: string }> {
  try {
    // ── AUTH: read userId from server-side cookie only ─────────────────────
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized: Valid Telegram session required.' };

    // 1. Verify the player belongs to this user's team
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found.' };

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, ovr, name')
      .eq('id', playerId)
      .single();

    if (playerError || !player) return { success: false, error: 'Player not found.' };
    // Ownership check — player must belong to this user's team
    if (player.team_id !== team.id)  return { success: false, error: 'This player does not belong to your team.' };
    if ((player.ovr || 0) < 85)      return { success: false, error: `${player.name} must reach OVR 85+ to retire as a legend (current: ${player.ovr}).` };

    // 2. Delete the legend card from the active roster
    const { error: deleteError } = await supabaseAdmin
      .from('players')
      .delete()
      .eq('id', playerId);

    if (deleteError) throw deleteError;

    // 3. Grant permanent prestige_multiplier buff (+0.02)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('prestige_multiplier')
      .eq('id', userId)
      .single();

    const currentMultiplier = Number(userData?.prestige_multiplier ?? 1.0);
    const newMultiplier     = Math.round((currentMultiplier + 0.02) * 10000) / 10000;

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ prestige_multiplier: newMultiplier })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { success: true, newMultiplier };

  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retire player.' };
  }
}
