import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { initData } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData parameter' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("CRITICAL: TELEGRAM_BOT_TOKEN is not configured in environment variables.");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Parse initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return NextResponse.json({ error: 'Invalid initData payload: missing hash' }, { status: 400 });
    }

    // Remove hash to prepare string for signature validation
    urlParams.delete('hash');
    
    // Sort parameters alphabetically
    const paramsArray: string[] = [];
    urlParams.forEach((value, key) => {
      paramsArray.push(`${key}=${value}`);
    });
    paramsArray.sort();
    
    const dataCheckString = paramsArray.join('\n');

    // 2. Compute HMAC-SHA-256 signature
    // Secret Key = HMAC-SHA-256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Hash = HMAC-SHA-256(secretKey, dataCheckString)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return NextResponse.json({ error: 'Invalid cryptographic signature' }, { status: 401 });
    }

    // 3. Validate expiration (auth_date) to prevent replay attacks
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return NextResponse.json({ error: 'Missing auth_date' }, { status: 401 });
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    
    // Disallow initData older than 24 hours (86400 seconds)
    if (now - authDate > 86400) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // 4. Parse user data securely authenticated by Telegram
    const userStr = urlParams.get('user');
    if (!userStr) {
      return NextResponse.json({ error: 'Missing user data payload' }, { status: 400 });
    }

    const telegramUser = JSON.parse(userStr);
    const telegramId = telegramUser.id.toString();

    // 5. Supabase User Sync (Upsert)
    // Check if the user already exists based on telegram_id
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 denotes zero rows found, which is expected for new users.
      throw new Error(`Database select error: ${selectError.message}`);
    }

    let internalUserId = null;

    if (existingUser) {
      // User exists. Capture their ID. (Could theoretically update 'last_login' here if added to schema)
      internalUserId = existingUser.id;
    } else {
      // User does not exist. Create the core record.
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Database insert error: ${insertError.message}`);
      }

      internalUserId = newUser.id;
    }

    // 6. Return successful authentication and internal mapping ID
    return NextResponse.json({ success: true, user_id: internalUserId });

  } catch (error: any) {
    console.error("Telegram WebApp Auth Error:", error);
    return NextResponse.json({ error: 'Authentication processing failed', details: error.message }, { status: 500 });
  }
}
