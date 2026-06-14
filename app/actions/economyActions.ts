'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ManagerProfileType = 'runner' | 'lifter' | 'yogi' | 'ball_player';
export type CurrencyType = 'cardio' | 'fitness' | 'ball' | 'strength';

export interface SyncStepsResult {
  added_steps: number;
  sp_gained: number;
  total_sp: number;
  daily_steps: number;
}

export interface ConvertSpResult {
  sp_spent: number;
  gained_coins: number;
  currency: CurrencyType;
  multiplier: number;
  new_balance_sp: number;
  new_balance_currency: number;
}

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get authenticated user ID from session cookie
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return (await verifySession()) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: syncStepsAction
//
// Calls the DB RPC `sync_daily_steps` which:
//   - Enforces a 25,000 steps/day hard cap
//   - Uses FLOOR math to prevent fractional SP accumulation
//   - Atomically credits Sweat Points with FOR UPDATE row locking
//
// Usage: call from fitness sync endpoints or training page.
// ─────────────────────────────────────────────────────────────────────────────

export async function syncStepsAction(
  stepsToAdd: number
): Promise<ActionResponse<SyncStepsResult>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    if (!Number.isInteger(stepsToAdd) || stepsToAdd < 0) {
      return { success: false, error: 'Invalid steps value: must be a non-negative integer.' };
    }

    const { data, error } = await supabase.rpc('sync_daily_steps', {
      p_user_id:      userId,
      p_steps_to_add: stepsToAdd,
    });

    if (error) {
      console.error('[syncStepsAction] RPC Error:', error);
      return { success: false, error: error.message ?? 'Failed to sync steps.' };
    }

    // Supabase returns the JSONB result as a parsed JS object
    const result = data as SyncStepsResult;

    // Invalidate all pages that may display step / SP balance
    revalidatePath('/');
    revalidatePath('/training');
    revalidatePath('/profile');

    return { success: true, data: result };

  } catch (err: any) {
    console.error('[syncStepsAction] Unexpected error:', err);
    return { success: false, error: err.message ?? 'An unexpected error occurred.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: convertSweatPointsAction
//
// Calls the DB RPC `convert_sp_to_currency` which:
//   - Locks the user row FOR UPDATE before any reads/writes
//   - Verifies the user has sufficient SP balance
//   - Applies the asymmetric multiplier matrix based on manager_profile:
//
//     Profile      | cardio | fitness | ball | strength
//     -------------|--------|---------|------|---------
//     runner       |  1.0   |  0.6    | 0.4  |  0.2
//     yogi         |  0.6   |  1.0    | 0.4  |  0.2
//     ball_player  |  0.2   |  0.6    | 1.0  |  0.4
//     lifter       |  0.2   |  0.4    | 0.6  |  1.0
//
//   - FLOORs the result to prevent fractional coin exploitation
//   - Atomically debits SP and credits the requested coin column
//
// Usage: call from Sweat Bank exchange UI.
// ─────────────────────────────────────────────────────────────────────────────

export async function convertSweatPointsAction(
  currencyType: CurrencyType,
  spAmount: number
): Promise<ActionResponse<ConvertSpResult>> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    const validCurrencies: CurrencyType[] = ['cardio', 'fitness', 'ball', 'strength'];
    if (!validCurrencies.includes(currencyType)) {
      return { success: false, error: `Invalid currency type: "${currencyType}". Must be one of: ${validCurrencies.join(', ')}.` };
    }

    if (!Number.isInteger(spAmount) || spAmount <= 0) {
      return { success: false, error: 'sp_amount must be a positive integer.' };
    }

    const { data, error } = await supabase.rpc('convert_sp_to_currency', {
      p_user_id:  userId,
      p_currency: currencyType,
      p_sp_amount: spAmount,
    });

    if (error) {
      console.error('[convertSweatPointsAction] RPC Error:', error);
      // Expose user-friendly message for balance errors from the DB
      const msg = error.message?.includes('Insufficient')
        ? 'Not enough Sweat Points to complete this exchange.'
        : (error.message ?? 'Conversion failed.');
      return { success: false, error: msg };
    }

    const result = data as ConvertSpResult;

    // Invalidate any page that shows wallet / coin balances
    revalidatePath('/');
    revalidatePath('/profile');

    return { success: true, data: result };

  } catch (err: any) {
    console.error('[convertSweatPointsAction] Unexpected error:', err);
    return { success: false, error: err.message ?? 'An unexpected error occurred.' };
  }
}
