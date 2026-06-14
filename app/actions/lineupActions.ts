'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/session';

export async function swapPlayers(playerOutId: string, playerInId: string) {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (!playerOutId || !playerInId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // 1. Verify user's team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, is_ready_for_match')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    // 2. Fetch both players to verify ownership and current status
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, lineup_status, lineup_slot, position')
      .in('id', [playerOutId, playerInId]);

    if (playersError || !players || players.length !== 2) {
      return { success: false, error: 'Players not found or invalid selection' };
    }

    // Check ownership
    if (players[0].team_id !== team.id || players[1].team_id !== team.id) {
      return { success: false, error: 'Players do not belong to your franchise' };
    }

    const playerOut = players.find(p => p.id === playerOutId);
    const playerIn = players.find(p => p.id === playerInId);

    if (!playerOut || !playerIn) {
      return { success: false, error: 'Invalid player IDs' };
    }

    const tempSlot = playerOut.lineup_slot || null;
    const tempStatus = playerOut.lineup_status;

    // 3. Perform the swap via two updates
    // We swap both `lineup_status` and `lineup_slot`
    const { error: update1Error } = await supabaseAdmin
      .from('players')
      .update({ 
        lineup_status: playerIn.lineup_status,
        lineup_slot: playerIn.lineup_slot || null
      })
      .eq('id', playerOut.id);

    const { error: update2Error } = await supabaseAdmin
      .from('players')
      .update({ 
        lineup_status: tempStatus,
        lineup_slot: tempSlot
      })
      .eq('id', playerIn.id);

    if (update1Error || update2Error) {
      return { success: false, error: 'Failed to execute swap in database' };
    }

    revalidatePath('/lineup');
    return { success: true, message: 'Swap successful' };

  } catch (error: any) {
    console.error("Lineup Swap Action Error:", error);
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export async function updatePlayers(payload: { id: string; lineup_status: string; lineup_slot: string | null }[]) {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // 1. Verify user's team
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    console.log('Sending payload to Supabase:', JSON.stringify(payload, null, 2));

    const updatePromises = payload.map(p => 
      supabaseAdmin
        .from('players')
        .update({
          lineup_status: p.lineup_status,
          lineup_slot: p.lineup_slot !== null && p.lineup_slot !== undefined ? String(p.lineup_slot) : null
        })
        .eq('id', p.id)
        .eq('team_id', team.id)
    );

    const results = await Promise.all(updatePromises);
    
    // Check for any errors in the batch
    const errors = results.filter(r => r.error).map(r => r.error);
    if (errors.length > 0) {
      console.error("Supabase bulk update errors:", errors);
      throw new Error(`Database error: Failed to update ${errors.length} players. First error: ${errors[0]?.message}`);
    }

    revalidatePath('/lineup');
    return { success: true };
  } catch (err: any) {
    console.error("updatePlayers Action Error:", err);
    return { success: false, error: err.message };
  }
}

const ALLOWED_TACTICS = ['Tiki-Taka', 'Counter Attack', 'High Press', 'Park the Bus', 'Wing Play', 'Balanced'];

export async function updateTeamTactic(tactic: string) {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (!ALLOWED_TACTICS.includes(tactic)) {
      return { success: false, error: 'Invalid tactic' };
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({ tactic })
      .eq('id', team.id);

    if (updateError) {
      throw updateError;
    }

    revalidatePath('/lineup');
    return { success: true };
  } catch (error: any) {
    console.error('Update team tactic failed:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

export async function updateTeamFormation(teamId: string, formation: string) {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    // 1. Verify user's team ownership
    const { data: teamAuth, error: teamAuthError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', tgUserId)
      .single();

    if (teamAuthError || !teamAuth) {
      return { success: false, error: 'Forbidden: You do not own this team.' };
    }

    // 2. Update Formation
    const allowedFormations = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1', '5-3-2', '3-4-3', '4-5-1'];
    if (!allowedFormations.includes(formation)) {
      return { success: false, error: 'Invalid formation' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({ formation })
      .eq('id', teamId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath('/lineup');
    return { success: true };
  } catch (error: any) {
    console.error('Update team formation failed:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

