import { google } from 'googleapis';

const CLIENT_ID = process.env.FITNESS_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.FITNESS_GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function getGoogleOAuthClient(appUrl: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Google Fitness OAuth credentials');
  }

  // Remove any trailing slashes from appUrl
  const baseUrl = appUrl.replace(/\/$/, '');
  const redirectUri = `${baseUrl}/api/fitness/auth/callback`;

  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    redirectUri
  );
}
