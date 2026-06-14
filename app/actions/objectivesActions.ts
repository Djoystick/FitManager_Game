'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/session';

// ─────────────────────────────────────────────────────────────────────────────
// objectivesActions.ts — Manager objectives CRUD
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return (await verifySession()) ?? null;
}

export interface ManagerObjective {
  id: string;
  team_id: string;
  season: number;
  title: string;
  competition: string;
  target: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'achieved' | 'failed';
  approval_rating: number;
  created_at: string;
}

/**
 * Fetch all objectives for the current team, current season.
 * Also returns the overall approval_rating (average across all objectives).
 */
export async function getManagerObjectivesAction(): Promise<{
  success: boolean;
  data?: ManagerObjective[];
  approvalRating?: number;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data, error } = await supabaseAdmin
      .from('manager_objectives')
      .select('*')
      .eq('team_id', team.id)
      .order('priority', { ascending: true })  // high first
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Seed defaults if empty
    if (!data || data.length === 0) {
      await supabaseAdmin.from('manager_objectives').insert([
        { team_id: team.id, season: 1, title: 'League Finish',    competition: 'Pro League',   target: 'Top 8',  priority: 'high',   approval_rating: 70 },
        { team_id: team.id, season: 1, title: 'Cup Run',          competition: 'National Cup',  target: 'Top 16', priority: 'medium', approval_rating: 65 },
        { team_id: team.id, season: 1, title: 'Squad Development',competition: 'Internal',      target: 'Avg OVR 60+', priority: 'low', approval_rating: 60 },
      ]);
      const { data: seeded } = await supabaseAdmin
        .from('manager_objectives').select('*').eq('team_id', team.id);
      const avg = seeded
        ? Math.round(seeded.reduce((s, o) => s + o.approval_rating, 0) / seeded.length)
        : 65;
      return { success: true, data: (seeded ?? []) as ManagerObjective[], approvalRating: avg };
    }

    const approvalRating = Math.round(
      data.reduce((s, o) => s + (o.approval_rating ?? 65), 0) / data.length
    );

    return { success: true, data: data as ManagerObjective[], approvalRating };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to fetch objectives' };
  }
}

/**
 * Update approval rating for an objective (called after match results).
 * Delta: positive = board pleased, negative = board unhappy.
 */
export async function updateApprovalRatingAction(
  objectiveId: string,
  delta: number
): Promise<{ success: boolean; newRating?: number; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: obj } = await supabaseAdmin
      .from('manager_objectives')
      .select('id, team_id, approval_rating')
      .eq('id', objectiveId)
      .single();

    if (!obj) return { success: false, error: 'Objective not found' };

    // Verify ownership
    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (!team || obj.team_id !== team.id)
      return { success: false, error: 'Unauthorized' };

    const newRating = Math.max(0, Math.min(100, (obj.approval_rating ?? 65) + delta));

    await supabaseAdmin
      .from('manager_objectives')
      .update({ approval_rating: newRating })
      .eq('id', objectiveId);

    revalidatePath('/profile');
    return { success: true, newRating };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mark an objective as achieved or failed.
 */
export async function resolveObjectiveAction(
  objectiveId: string,
  status: 'achieved' | 'failed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    await supabaseAdmin
      .from('manager_objectives')
      .update({ status })
      .eq('id', objectiveId);

    revalidatePath('/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
