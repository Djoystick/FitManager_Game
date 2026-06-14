import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set google_refresh_token to null to unlink the account
    const { error } = await supabase
      .from('users')
      .update({ google_refresh_token: null })
      .eq('id', userId);

    if (error) {
      console.error('Error unlinking Google Fit:', error);
      return NextResponse.json({ error: 'Failed to unlink Google Fit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unlink API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
