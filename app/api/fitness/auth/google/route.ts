import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleFitness';

export async function GET() {
  try {
    const oauth2Client = getGoogleOAuthClient();

    // Generate a secure auth URL
    const url = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      
      // We must force prompt to get a refresh token in some cases,
      // but 'consent' makes them see the permission screen every time.
      prompt: 'consent',

      // The scope we need to read fitness data
      scope: [
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.location.read'
      ],
    });

    // Redirect user to Google OAuth login
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Google Auth Error:', error);
    return NextResponse.json({ error: 'Failed to initialize Google Auth' }, { status: 500 });
  }
}
