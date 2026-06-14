import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

export async function requireTeam() {
  const userId = await verifySession();

  if (!userId) {
    // Cannot redirect to onboarding if we don't know who the user is.
    // They will hit the Telegram Auth screen on page load.
    return null;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('user_id', userId)
    .single();

  if (!team) {
    redirect('/onboarding');
  }

  return team;
}
