'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function swapPlayers(playerOutId: string, playerInId: string) {
  try {
    const cookieStore = await cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (!playerOutId || !playerInId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // 1. Verify user's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, is_ready_for_match')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    if (team.is_ready_for_match) {
      return { success: false, error: 'Cannot swap players while lineup is locked for a match' };
    }

    // 2. Fetch both players to verify ownership and current status
    const { data: players, error: playersError } = await supabase
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

    // 3. Perform the swap via two updates
    // We swap both `lineup_status` and `lineup_slot`
    const { error: update1Error } = await supabase
      .from('players')
      .update({ 
        lineup_status: playerIn.lineup_status,
        lineup_slot: playerIn.lineup_slot
      })
      .eq('id', playerOut.id);

    const { error: update2Error } = await supabase
      .from('players')
      .update({ 
        lineup_status: playerOut.lineup_status,
        lineup_slot: playerOut.lineup_slot
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
