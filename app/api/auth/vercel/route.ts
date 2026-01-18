import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

export async function GET(request: NextRequest) {
  if (!VERCEL_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/integrations?error=vercel_not_configured`);
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Vercel OAuth URL
  const authUrl = new URL('https://vercel.com/oauth/authorize');
  authUrl.searchParams.set('client_id', VERCEL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/auth/vercel/callback`);
  authUrl.searchParams.set('scope', 'user:read deployments:read deployments:write logs:read projects:read');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl.toString());

  // Store state in cookie for verification
  response.cookies.set('vercel_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}

// Also support POST for token-based auth
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify token by fetching user info
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userData = await userRes.json();

    const response = NextResponse.json({
      success: true,
      user: {
        name: userData.user.name || userData.user.username,
        email: userData.user.email,
        avatar: userData.user.avatar,
      },
    });

    // Store token in cookie
    response.cookies.set('vercel_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    response.cookies.set('vercel_user', JSON.stringify({
      name: userData.user.name || userData.user.username,
      email: userData.user.email,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Vercel auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
