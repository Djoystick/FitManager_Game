'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/session';

// ─────────────────────────────────────────────────────────────────────────────
// staffActions.ts — CRUD for staff/coaches table
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return (await verifySession()) ?? null;
}

export interface StaffMember {
  id: string;
  team_id: string;
  name: string;
  role: 'youth_coach' | 'head_coach' | 'medical_staff' | 'head_scout';
  star_rating: number;
  attr_sta: number;
  attr_agi: number;
  attr_ovr_bonus: number;
  attr_recovery: number;
  contract_weeks: number;
  weeks_remaining: number;
  salary_per_week: number;
  hiring_cost: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Fetch all active staff for the current user's team.
 */
export async function getStaffAction(): Promise<{ success: boolean; data?: StaffMember[]; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('team_id', team.id)
      .eq('is_active', true)
      .order('star_rating', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data ?? []) as StaffMember[] };
  } catch (err: any) {
    console.error('[getStaffAction] error:', err);
    return { success: false, error: err.message ?? 'Failed to fetch staff' };
  }
}

/**
 * Fire a staff member (delete from team).
 */
export async function fireStaffAction(
  staffId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    // Verify staff belongs to this team
    const { data: member } = await supabaseAdmin
      .from('staff').select('id, team_id').eq('id', staffId).single();
    if (!member || member.team_id !== team.id)
      return { success: false, error: 'Staff member not found' };

    await supabaseAdmin.from('staff').delete().eq('id', staffId);

    revalidatePath('/staff');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to fire staff' };
  }
}

/**
 * Hire a new staff member. Costs FC upfront + weekly salary.
 * Slot limit: max staff = training_camp_level.
 */
export async function hireStaffAction(
  role: 'youth_coach' | 'head_coach' | 'medical_staff' | 'head_scout'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    // Check slot limit: max active staff = training_camp_level
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('training_camp_level')
      .eq('team_id', team.id)
      .maybeSingle();

    const maxSlots = infra?.training_camp_level ?? 1;

    const { count: currentStaff } = await supabaseAdmin
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('is_active', true);

    if ((currentStaff ?? 0) >= maxSlots) {
      return { success: false, error: `Staff limit reached (${maxSlots} slots). Upgrade Training Camp.` };
    }

    // Generate random star rating (weighted: higher stars are rarer)
    const roll = Math.random();
    const starRating = roll < 0.40 ? 1 : roll < 0.70 ? 2 : roll < 0.88 ? 3 : roll < 0.97 ? 4 : 5;

    // Salary scales with stars: base 150 + 100 per star
    const salaryPerWeek = 150 + starRating * 100;
    // Hiring cost: base 2000 + 1000 per star
    const hiringCost = 2000 + starRating * 1000;

    // Check balance
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .single();

    if ((user?.balance_fancoins ?? 0) < hiringCost) {
      return { success: false, error: `Need ${hiringCost} FC to hire staff` };
    }

    // Deduct hiring cost
    const { error: deductErr } = await supabaseAdmin.rpc('deduct_fancoins', {
      user_id: userId,
      amount: hiringCost,
    });
    if (deductErr) return { success: false, error: 'Insufficient FanCoins' };

    // Generate name
    const FIRST = ['Marcus','Sofia','Jin','Elena','Omar','Ana','Kofi','Lars','Diego','Hans','Yuki','Aisha','Leon','Nina','Kenji','Maya','Lucas','Zara','Oliver','Mia'];
    const LAST = ['Bell','Rossi','Park','Volkov','Farouq','Lima','Mensah','Hendricks','Silva','Muller','Tanaka','Ali','Gomez','Ivanov','Sato','Patel','Smith','Dubois','Jones','Kim'];
    const name = `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;

    // Generate attributes based on role and star rating
    const baseAttr = 30 + starRating * 10; // 40-80 base
    let attr_sta = 50, attr_agi = 50, attr_ovr_bonus = 0, attr_recovery = 0;

    if (role === 'youth_coach') {
      attr_sta = Math.min(99, baseAttr + Math.floor(Math.random() * 20));
      attr_agi = Math.min(99, baseAttr + Math.floor(Math.random() * 20));
    } else if (role === 'head_coach') {
      attr_ovr_bonus = Math.min(20, starRating * 3 + Math.floor(Math.random() * 5));
    } else if (role === 'medical_staff') {
      attr_recovery = Math.min(30, starRating * 4 + Math.floor(Math.random() * 5));
    }
    // head_scout: no special attrs needed (archetype scouting is a feature flag)

    const contractWeeks = 26; // 6-month contract

    const newStaff = {
      team_id: team.id,
      name,
      role,
      star_rating: starRating,
      attr_sta,
      attr_agi,
      attr_ovr_bonus,
      attr_recovery,
      contract_weeks: contractWeeks,
      weeks_remaining: contractWeeks,
      salary_per_week: salaryPerWeek,
      hiring_cost: hiringCost,
      is_active: true,
    };

    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert(newStaff)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/staff');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to hire staff' };
  }
}
