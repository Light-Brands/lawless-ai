import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawless-ai.vercel.app';

// Check if Supabase is configured
const USE_SUPABASE_AUTH = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Legacy GitHub OAuth config (fallback)
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const REDIRECT_URI = `${APP_URL}/api/auth/github/callback`;

export async function GET(request: NextRequest) {
  // If Supabase is configured, use Supabase Auth
  if (USE_SUPABASE_AUTH) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${APP_URL}/api/auth/callback`,
        scopes: 'repo delete_repo user:email',
      },
    });

    if (error) {
      console.error('Supabase OAuth error:', error);
      return NextResponse.redirect(`${APP_URL}?error=oauth_failed`);
    }

    if (data.url) {
      return NextResponse.redirect(data.url);
    }

    return NextResponse.redirect(`${APP_URL}?error=oauth_failed`);
  }

  // Legacy: Direct GitHub OAuth (when Supabase is not configured)
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
  }

  // Request repo scope for read/write access, delete_repo for deletion
  const scope = 'repo delete_repo user:email';

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  githubAuthUrl.searchParams.set('scope', scope);
  githubAuthUrl.searchParams.set('state', crypto.randomUUID());

  return NextResponse.redirect(githubAuthUrl.toString());
}
