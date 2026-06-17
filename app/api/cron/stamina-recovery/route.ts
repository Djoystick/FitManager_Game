import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('passive_stamina_recovery');

    if (error) {
      console.error('[stamina-recovery] RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[stamina-recovery] Done:', JSON.stringify(data));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[stamina-recovery] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
