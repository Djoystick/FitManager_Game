import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateTelegramWebAppData } from '@/lib/telegramAuth';

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
    const { error } = await supabaseAdmin
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
