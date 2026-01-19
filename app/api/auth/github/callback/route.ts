import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

export const runtime = 'nodejs';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${APP_URL}?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}?error=no_code`);
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_URL}?error=oauth_not_configured`);
  }

  try {
    // Get current user from Supabase (must be logged in already)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}?error=not_authenticated`);
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.redirect(`${APP_URL}?error=no_github_username`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData);
      return NextResponse.redirect(`${APP_URL}?error=${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // Verify token by getting user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${APP_URL}?error=invalid_token`);
    }

    // Store encrypted token in database
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.redirect(`${APP_URL}?error=encryption_not_configured`);
    }

    const serviceClient = createServiceClient();
    const encryptedToken = encryptToken(accessToken);

    const { error: dbError } = await serviceClient.from('integration_connections').upsert(
      {
        user_id: githubUsername,
        provider: 'github',
        access_token: encryptedToken,
        metadata: {
          username: githubUsername,
        },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,provider' }
    );

    if (dbError) {
      console.error('Failed to store GitHub token in database:', dbError);
      return NextResponse.redirect(`${APP_URL}?error=database_error`);
    }

    return NextResponse.redirect(`${APP_URL}/repos`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(`${APP_URL}?error=oauth_failed`);
  }
}
