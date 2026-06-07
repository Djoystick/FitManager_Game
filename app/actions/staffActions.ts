'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ─────────────────────────────────────────────────────────────────────────────
// staffActions.ts — CRUD for staff/coaches table
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('tg_user_id')?.value ?? null;
}

export interface StaffMember {
  id: string;
  team_id: string;
  name: string;
  role: 'head_coach' | 'assistant_coach' | 'gk_coach' | 'fitness_coach' | 'scout';
  department: 'first_team' | 'academy';
  age: number;
  nationality: string;
  contract_end: string;
  salary_per_match: number;
  attr_def: number;
  attr_pas: number;
  attr_sho: number;
  attr_pac: number;
  attr_phy: number;
  attr_men: number;
  attr_gkp: number;
  created_at: string;
}

/**
 * Fetch all staff for the current user's team,
 * optionally filtered by department.
 */
export async function getStaffAction(
  department?: 'first_team' | 'academy'
): Promise<{ success: boolean; data?: StaffMember[]; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    let query = supabaseAdmin
      .from('staff')
      .select('*')
      .eq('team_id', team.id)
      .order('role');

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) throw error;

    // If no staff exist yet (team created before migration), seed defaults
    if (!data || data.length === 0) {
      await supabaseAdmin.from('staff').insert([
        {
          team_id: team.id, name: 'Main Team Coach', role: 'head_coach',
          department: 'first_team', age: 42, nationality: 'CyberCity',
          salary_per_match: 200,
          attr_def: 55, attr_pas: 50, attr_sho: 45,
          attr_pac: 45, attr_phy: 50, attr_men: 60, attr_gkp: 10,
        },
        {
          team_id: team.id, name: 'Main Team Scout', role: 'scout',
          department: 'first_team', age: 35, nationality: 'CyberCity',
          salary_per_match: 80,
          attr_def: 30, attr_pas: 50, attr_sho: 30,
          attr_pac: 55, attr_phy: 35, attr_men: 45, attr_gkp: 10,
        },
      ]);

      const { data: seeded } = await supabaseAdmin
        .from('staff')
        .select('*')
        .eq('team_id', team.id);

      return { success: true, data: (seeded ?? []) as StaffMember[] };
    }

    return { success: true, data: data as StaffMember[] };
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
 * Hire a new randomly-generated staff member.
 * In a real implementation, this would cost FanCoins.
 */
export async function hireStaffAction(
  role: StaffMember['role'],
  department: StaffMember['department']
): Promise<{ success: boolean; data?: StaffMember; error?: string }> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const NAMES = ['Marcus Bell','Sofia Rossi','Jin Park','Elena Volkov',
                   'Omar Farouq','Ana Lima','Kofi Mensah','Lars Hendricks'];
    const NATS  = ['England','Italy','South Korea','Russia',
                   'Egypt','Brazil','Ghana','Netherlands'];
    const idx = Math.floor(Math.random() * NAMES.length);

    const base = 40 + Math.floor(Math.random() * 20);
    const newMember = {
      team_id: team.id,
      name: NAMES[idx],
      role,
      department,
      age: 28 + Math.floor(Math.random() * 20),
      nationality: NATS[idx],
      contract_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      salary_per_match: role === 'head_coach' ? 250 : role === 'scout' ? 80 : 150,
      attr_def: base + Math.floor(Math.random() * 20),
      attr_pas: base + Math.floor(Math.random() * 20),
      attr_sho: base + Math.floor(Math.random() * 20),
      attr_pac: base + Math.floor(Math.random() * 20),
      attr_phy: base + Math.floor(Math.random() * 20),
      attr_men: base + Math.floor(Math.random() * 25),
      attr_gkp: role === 'gk_coach' ? base + Math.floor(Math.random() * 30) : 10,
    };

    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert(newMember)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/staff');
    return { success: true, data: data as StaffMember };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to hire staff' };
  }
}
