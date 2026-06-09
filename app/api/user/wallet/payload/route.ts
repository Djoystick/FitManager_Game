import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a short unique nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Create the JWT payload
    const tokenPayload = {
      nonce,
      userId,
    };

    // Use a secure server-side secret (e.g., bot token or dedicated secret)
    const secret = process.env.TELEGRAM_BOT_TOKEN || 'fallback-secret-fitmanager';
    
    // Sign the JWT with a 15-minute expiration
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '15m' });

    // The token itself will be the payload that the user's wallet will sign
    return NextResponse.json({ payload: token });
  } catch (error: any) {
    console.error("Payload generation error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
