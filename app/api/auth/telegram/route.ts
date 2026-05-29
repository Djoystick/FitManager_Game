import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { validateTelegramWebAppData } from '@/lib/telegramAuth';

export async function POST(req: Request) {
  try {
    const { initData, photoUrl } = await req.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("CRITICAL: TELEGRAM_BOT_TOKEN is not configured in environment variables.");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Validate the initData using the secure utility
    const validation = validateTelegramWebAppData(initData, botToken);
    
    if (!validation.isValid || !validation.user) {
      return NextResponse.json({ error: validation.error || 'Authentication failed' }, { status: 401 });
    }

    const telegramId = validation.user.id.toString();

    // 2. Supabase User Sync (Upsert)
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw new Error(`Database select error: ${selectError.message}`);
    }

    let internalUserId = null;

    if (existingUser) {
      internalUserId = existingUser.id;
      if (photoUrl) {
        await supabase.from('users').update({ avatar_url: photoUrl }).eq('id', internalUserId);
      }
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          avatar_url: photoUrl || null,
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Database insert error: ${insertError.message}`);
      }

      internalUserId = newUser.id;
    }

    // 3. Set a secure HTTP-Only Cookie to protect subsequent Server Actions
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'tg_user_id',
      value: internalUserId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return NextResponse.json({ success: true, user_id: internalUserId });

  } catch (error: any) {
    console.error("Telegram WebApp Auth Error:", error);
    return NextResponse.json({ error: 'Authentication processing failed', details: error.message }, { status: 500 });
  }
}
