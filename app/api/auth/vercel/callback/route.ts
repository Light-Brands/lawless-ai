import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

export const runtime = 'nodejs';

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=no_code`);
  }

  // Verify state (temporary CSRF cookie is ok for OAuth flow)
  const storedState = request.cookies.get('vercel_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=invalid_state`);
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=vercel_not_configured`);
  }

  try {
    // Get current user from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/integrations?error=not_authenticated`);
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.redirect(`${APP_URL}/integrations?error=no_github_username`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: VERCEL_CLIENT_ID,
        client_secret: VERCEL_CLIENT_SECRET,
        code,
        redirect_uri: `${APP_URL}/api/auth/vercel/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Vercel OAuth error:', tokenData);
      return NextResponse.redirect(`${APP_URL}/integrations?error=${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();

    // Store encrypted token in database
    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.redirect(`${APP_URL}/integrations?error=encryption_not_configured`);
    }

    const serviceClient = createServiceClient();
    const encryptedToken = encryptToken(accessToken);

    const { error: dbError } = await serviceClient.from('integration_connections').upsert(
      {
        user_id: githubUsername,
        provider: 'vercel',
        access_token: encryptedToken,
        metadata: {
          name: userData.user?.name || userData.user?.username || 'Vercel User',
          email: userData.user?.email || '',
          avatar: userData.user?.avatar,
        },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,provider' }
    );

    if (dbError) {
      console.error('Failed to store Vercel token in database:', dbError);
      return NextResponse.redirect(`${APP_URL}/integrations?error=database_error`);
    }

    // Create response with redirect to integrations page
    const response = NextResponse.redirect(`${APP_URL}/integrations/vercel`);

    // Clear state cookie
    response.cookies.set('vercel_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Vercel OAuth callback error:', error);
    return NextResponse.redirect(`${APP_URL}/integrations?error=oauth_failed`);
  }
}
