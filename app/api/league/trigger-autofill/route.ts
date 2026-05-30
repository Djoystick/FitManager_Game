import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get user's team
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return NextResponse.json({ error: 'No team found' }, { status: 400 });

    // 2. Check if the user's team is in a filling league
    const { data: standing } = await supabaseAdmin
      .from('league_standings')
      .select('league_instance_id, league_instances!inner(status)')
      .eq('team_id', team.id)
      .eq('league_instances.status', 'filling')
      .single();

    if (!standing) {
      return NextResponse.json({ message: 'User not in a filling league' });
    }

    // 3. We use the internal CRON endpoint securely from the server side!
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const cronSecret = process.env.CRON_SECRET || '';
    
    // Fire and forget or await
    await fetch(`${baseUrl}/api/cron/league-autofill`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${cronSecret}` }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[trigger-autofill] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
