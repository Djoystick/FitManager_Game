'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function updateLineupStatus(playerId: string, teamId: string, newStatus: 'starting' | 'bench') {
  try {
    const cookieStore = await cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;
    
    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    // Security: Verify the team belongs to the authenticated user
    const { data: teamAuth, error: teamAuthError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', tgUserId)
      .single();

    if (teamAuthError || !teamAuth) {
      return { success: false, error: 'Forbidden: You do not own this team.' };
    }
    if (newStatus === 'starting') {
      // Check the current count of starting players for this team
      const { data: startingPlayers, error: countError } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', teamId)
        .eq('lineup_status', 'starting');

      if (countError) {
        throw new Error('Failed to verify squad limit.');
      }

      // If the player is already starting, do nothing. But if we are adding a new starter:
      const currentlyStarting = startingPlayers?.some(p => p.id === playerId);
      if (!currentlyStarting && startingPlayers && startingPlayers.length >= 11) {
        return { success: false, error: 'Maximum of 11 starting players allowed.' };
      }
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('players')
      .update({ lineup_status: newStatus })
      .eq('id', playerId);

    if (updateError) {
      throw updateError;
    }

    // Invalidate the cache to ensure UI is in sync after the optimistic update
    revalidatePath('/squad');
    
    return { success: true };
  } catch (error: any) {
    console.error('Update lineup status failed:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
