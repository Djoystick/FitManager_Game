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

    // Generate a short unique nonce (32 bytes = 64 hex characters, well within 128 bytes limit)
    const payload = crypto.randomBytes(32).toString('hex');
    
    // Store the nonce in a secure HttpOnly cookie to verify later
    cookieStore.set('ton_proof_nonce', payload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 900 // 15 minutes
    });

    return NextResponse.json({ payload });
  } catch (error: any) {
    console.error("Payload generation error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
