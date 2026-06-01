import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel cron uses GET
export async function GET(req: Request) {
  // Optional security: Vercel CRON secret check
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the RPC function we created in migration
    const { error } = await supabaseAdmin.rpc('update_achievement_stats');

    if (error) {
      console.error('[CRON] achievements-stats error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log it
    try {
      const { Logger } = await import('@/lib/logger');
      Logger.info('cron:achievements-stats', 'Achievement rarity updated successfully');
    } catch(e) {}

    return NextResponse.json({ success: true, message: 'Stats updated successfully' });

  } catch (error: any) {
    console.error('[CRON] achievements-stats Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
