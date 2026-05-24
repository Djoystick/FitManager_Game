'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { matchService } from '@/services/matchService';
import { cookies } from 'next/headers';

export async function logTrainingSession(userId: string, durationMinutes: number, steps: number) {
  try {
    const cookieStore = cookies();
    const tgUserId = cookieStore.get('tg_user_id')?.value;
    
    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (userId !== tgUserId) {
      return { success: false, error: 'Forbidden: User ID mismatch.' };
    }
    if (!userId) {
      return { success: false, error: 'User ID is required.' };
    }

    const sessionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const metValue = 5.0; // Hardcoded average MET for the sake of the W2E walking/running hybrid
    const baseTp = Math.floor(steps / 100); // Base logic: 100 steps = 1 TP

    // Call the Anti-Cheat RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('apply_overtraining_penalty', {
      p_user_id: userId,
      p_session_date: sessionDate,
      p_base_tp: baseTp,
      p_met: metValue,
      p_duration: durationMinutes,
      p_steps: steps
    });

    if (rpcError) {
      console.error('[logTrainingSession] RPC Error:', rpcError);
      return { success: false, error: 'Database validation failed. Please try again.' };
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    // Additionally, sync the user's balance and total steps in the users table via the old sync_daily_steps logic
    // We update the balances natively since the RPC only created the audit log
    if (result && result.session_status !== 'rejected') {
      const { error: updateError } = await supabase.rpc('sync_daily_steps', {
        u_id: userId,
        steps_to_add: steps,
        today_date: sessionDate
      });
      if (updateError) console.error("sync_daily_steps failed:", updateError);
    }

    // Invalidate Team OVR Cache as requested
    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamData && teamData.id) {
      matchService.invalidateTeamOVR(teamData.id);
    }

    // Revalidate the UI to show the new badge/penalty factor
    revalidatePath('/training');
    
    return { 
      success: true, 
      earnedTp: result.earned_tp, 
      factor: result.factor, 
      status: result.session_status 
    };

  } catch (error: any) {
    console.error('[logTrainingSession] Unexpected Error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
