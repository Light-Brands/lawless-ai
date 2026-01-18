import { NextRequest, NextResponse } from 'next/server';

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

  // Verify state
  const storedState = request.cookies.get('vercel_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=invalid_state`);
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=vercel_not_configured`);
  }

  try {
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

    // Store token in HTTP-only cookie
    response.cookies.set('vercel_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Store user info in accessible cookie for UI
    response.cookies.set('vercel_user', JSON.stringify({
      name: userData.user?.name || userData.user?.username || 'Vercel User',
      email: userData.user?.email || '',
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Vercel OAuth callback error:', error);
    return NextResponse.redirect(`${APP_URL}/integrations?error=oauth_failed`);
  }
}
