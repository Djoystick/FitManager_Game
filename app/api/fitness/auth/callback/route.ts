import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleFitness';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = url.origin;
    const code = url.searchParams.get('code');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      console.error('Google Auth Error from redirect:', errorParam);
      return NextResponse.redirect(`${origin}?error=google_auth_failed`);
    }

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      // Not authenticated in our app
      return NextResponse.redirect(`${origin}?error=unauthorized_in_game`);
    }

    const oauth2Client = getGoogleOAuthClient(origin);

    // Exchange auth code for access & refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // tokens.refresh_token is what we need for offline background sync
    // If the user already authorized the app before, Google might only return access_token
    // unless prompt='consent' was used.
    
    // We update the user record. If no refresh_token is returned, we might just fail
    // or rely on a previously stored one. For MVP, we assume we get it.
    if (tokens.refresh_token) {
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          google_refresh_token: tokens.refresh_token 
        })
        .eq('id', userId);
        
      if (dbError) {
        console.error('Failed to save refresh token:', dbError);
        return NextResponse.redirect(`${origin}?error=database_error`);
      }
    }

    // Success! Redirect back to the game (e.g. the Profile or Fitness modal)
    // We can just redirect to the home base and let the client handle success via query param
    return NextResponse.redirect(`${origin}?fitness_connected=true`);

  } catch (error: any) {
    console.error('Google Callback Error:', error);
    const { origin } = new URL(req.url);
    return NextResponse.redirect(`${origin}?error=server_error`);
  }
}
