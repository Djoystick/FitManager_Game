'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { ACHIEVEMENTS, AchievementCode } from '@/lib/achievementsDict';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getUserAchievements() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;
  if (!userId) return { success: false, error: 'Unauthorized' };

  // Get user achievements
  const { data: userAchs, error: uaError } = await supabaseAdmin
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);

  // Get global stats
  const { data: stats, error: statsError } = await supabaseAdmin
    .from('achievement_global_stats')
    .select('*');

  if (uaError) return { success: false, error: uaError.message };

  return { success: true, achievements: userAchs || [], stats: stats || [] };
}

export async function unlockAchievement(userId: string, code: AchievementCode) {
  try {
    // Upsert to handle concurrent duplicate unlocks gracefully
    const { error } = await supabaseAdmin.from('user_achievements').upsert({
      user_id: userId,
      achievement_code: code,
      reward_claimed: false
    }, { onConflict: 'user_id, achievement_code', ignoreDuplicates: true });

    if (error) {
      console.error('[Achievements] Failed to unlock:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function claimAchievementReward(code: AchievementCode) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const def = ACHIEVEMENTS[code];
  if (!def) return { success: false, error: 'Unknown achievement' };

  try {
    // 1. Check if unlocked and not claimed
    const { data: ach, error: fetchErr } = await supabaseAdmin
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_code', code)
      .single();

    if (fetchErr || !ach) return { success: false, error: 'Achievement not unlocked yet' };
    if (ach.reward_claimed) return { success: false, error: 'Reward already claimed' };

    // 2. Mark as claimed
    const { error: updateErr } = await supabaseAdmin
      .from('user_achievements')
      .update({ reward_claimed: true })
      .eq('id', ach.id);

    if (updateErr) return { success: false, error: 'Failed to claim' };

    // 3. Grant rewards
    // First get current balance
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('fancoins, real_balance')
      .eq('id', userId)
      .single();

    if (userErr || !user) return { success: false, error: 'User not found' };

    const newFc = user.fancoins + (def.reward.fc || 0);
    const newTon = user.real_balance + (def.reward.ton || 0);

    const { error: finalErr } = await supabaseAdmin
      .from('users')
      .update({ fancoins: newFc, real_balance: newTon })
      .eq('id', userId);

    if (finalErr) return { success: false, error: 'Failed to add reward' };

    // Log the event
    try {
      const { Logger } = await import('@/lib/logger');
      Logger.info('action:claim-achievement', `User ${userId} claimed ${code}`, { reward: def.reward });
    } catch(e) {}

    return { success: true, newFc, newTon };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
