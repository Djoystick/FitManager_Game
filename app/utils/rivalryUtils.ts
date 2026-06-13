import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function isDerbyMatch(userIdA: string, userIdB: string): Promise<boolean> {
  try {
    const userA = userIdA < userIdB ? userIdA : userIdB;
    const userB = userIdA < userIdB ? userIdB : userIdA;

    const { data } = await supabaseAdmin
      .from('manager_rivalries')
      .select('is_derby')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .maybeSingle();

    return data?.is_derby ?? false;
  } catch {
    return false;
  }
}

export async function getRivalryStats(userIdA: string, userIdB: string) {
  try {
    const userA = userIdA < userIdB ? userIdA : userIdB;
    const userB = userIdA < userIdB ? userIdB : userIdA;

    const { data } = await supabaseAdmin
      .from('manager_rivalries')
      .select('*')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .maybeSingle();

    return data;
  } catch {
    return null;
  }
}
