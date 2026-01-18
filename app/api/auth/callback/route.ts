import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

export const runtime = 'nodejs';

function getAppUrl(request: NextRequest): string {
  // Use VERCEL_URL in production, or detect from request
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // For custom domains, use the request host
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  if (host && !host.includes('localhost')) {
    return `${protocol}://${host}`;
  }
  // Fallback for local development
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Supabase Auth callback handler
 * This endpoint handles the OAuth callback from Supabase Auth (GitHub OAuth)
 */
export async function GET(request: NextRequest) {
  const APP_URL = getAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') || '/repos';

  if (error) {
    console.error('Supabase OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${APP_URL}?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}?error=no_code`);
  }

  const supabase = await createClient();

  // Exchange code for session
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

  if (sessionError) {
    console.error('Session exchange error:', sessionError);
    return NextResponse.redirect(`${APP_URL}?error=auth_failed`);
  }

  const { session, user } = sessionData;

  if (!session || !user) {
    return NextResponse.redirect(`${APP_URL}?error=no_session`);
  }

  // Get GitHub identity and access token from the session
  const githubIdentity = user.identities?.find(i => i.provider === 'github');
  const providerToken = session.provider_token;

  // Use service role client for database operations (bypasses RLS)
  const serviceClient = createServiceClient();

  // Upsert user record in our users table
  const { error: upsertError } = await serviceClient.from('users').upsert(
    {
      id: user.id,
      github_username: user.user_metadata?.user_name || user.user_metadata?.preferred_username,
      github_id: githubIdentity?.id,
      avatar_url: user.user_metadata?.avatar_url,
      display_name: user.user_metadata?.full_name || user.user_metadata?.name,
      updated_at: new Date().toISOString(),
    } as never,
    {
      onConflict: 'id',
    }
  );

  if (upsertError) {
    console.error('User upsert error:', upsertError);
    // Don't fail the auth - user can still use the app
  } else {
    console.log('User record created/updated for:', user.id);
  }

  // If we have a provider token (GitHub access token), store it encrypted
  if (providerToken && process.env.ENCRYPTION_KEY) {
    try {
      const encryptedToken = encryptToken(providerToken);

      const { error: tokenError } = await serviceClient.from('integration_connections').upsert(
        {
          user_id: user.id,
          provider: 'github',
          access_token: encryptedToken,
          metadata: {
            username: user.user_metadata?.user_name,
            scopes: 'repo delete_repo user:email',
          },
          updated_at: new Date().toISOString(),
        } as never,
        {
          onConflict: 'user_id,provider',
        }
      );

      if (tokenError) {
        console.error('Token storage error:', tokenError);
      } else {
        console.log('GitHub token stored for user:', user.id);
      }
    } catch (err) {
      console.error('Token encryption error:', err);
    }
  } else {
    console.log('No provider token available or encryption key missing');
    console.log('Provider token exists:', !!providerToken);
    console.log('Encryption key exists:', !!process.env.ENCRYPTION_KEY);
  }

  // Create response with redirect
  const response = NextResponse.redirect(`${APP_URL}${next}`);

  // Also set legacy cookie for backward compatibility with existing code
  // that reads github_user cookie for UI display
  if (user.user_metadata?.user_name) {
    response.cookies.set('github_user', user.user_metadata.user_name, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}
