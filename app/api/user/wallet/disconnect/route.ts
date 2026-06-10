import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateTelegramWebAppData } from '@/lib/telegramAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('tma ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const initData = authHeader.split(' ')[1];
    const validation = validateTelegramWebAppData(initData, process.env.TELEGRAM_BOT_TOKEN!);
    
    if (!validation.isValid || !validation.user || !validation.user.id) {
      return NextResponse.json({ error: 'Invalid Telegram Auth' }, { status: 401 });
    }

    // Unlink the wallet in the database
    const { error } = await supabase
      .from('users')
      .update({ wallet_address: null })
      .eq('telegram_id', validation.user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Wallet disconnect error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
