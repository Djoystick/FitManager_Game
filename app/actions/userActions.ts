'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Server-side border definitions — DO NOT trust client prices
const BORDERS = [
  { id: 'default', cost: 0 },
  { id: 'neon-cyan', cost: 500 },
  { id: 'gold-glow', cost: 1500 },
  { id: 'toxic-venom', cost: 2000 },
  { id: 'bloody-crimson', cost: 2500 },
  { id: 'fire', cost: 3000 },
  { id: 'golden-leaves', cost: 4000 },
  { id: 'cyber-glitch', cost: 5000 },
  { id: 'void-abyss', cost: 6000 },
  { id: 'diamond-frost', cost: 7500 },
  { id: 'electric-shock', cost: 8500 },
  { id: 'plasma-storm', cost: 10000 },
  { id: 'holographic', cost: 15000 },
] as const;

type BorderId = (typeof BORDERS)[number]['id'];

function isValidBorder(id: string): id is BorderId {
  return BORDERS.some(b => b.id === id);
}

export async function buyAndSelectAvatarBorder(borderId: string) {
  try {
    const userId = await verifySession();
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (!isValidBorder(borderId)) {
      return { success: false, error: 'Invalid border id' };
    }

    const border = BORDERS.find(b => b.id === borderId)!;

    // Fetch current user state
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins, active_border, unlocked_borders')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    const alreadyUnlocked = (user.unlocked_borders ?? []).includes(borderId);

    if (alreadyUnlocked) {
      // Just switch active border — no charge
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ active_border: borderId })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      revalidatePath('/profile');
      return { success: true, active_border: borderId, new_balance: user.balance_fancoins };
    }

    // Not yet unlocked — must pay
    if (border.cost > 0 && (user.balance_fancoins ?? 0) < border.cost) {
      return { success: false, error: 'Insufficient FanCoins' };
    }

    // Atomic deduction via RPC (prevents double-spend race condition)
    const { data: newBalance, error: deductErr } = await supabaseAdmin
      .rpc('deduct_fancoins', { user_id: userId, amount: border.cost });

    if (deductErr) throw deductErr;

    // Add border to unlocked array and set as active
    const updatedBorders = [...(user.unlocked_borders ?? []), borderId];
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        active_border: borderId,
        unlocked_borders: updatedBorders,
      })
      .eq('id', userId);

    if (updateErr) {
      // Rollback: refund the deduction
      await supabaseAdmin.rpc('increment_fancoins', { u_id: userId, amount: border.cost });
      throw updateErr;
    }

    revalidatePath('/profile');
    return { success: true, active_border: borderId, new_balance: newBalance };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to purchase border' };
  }
}
