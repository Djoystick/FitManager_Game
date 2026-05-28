import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export async function requireTeam() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;

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
