import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

function getAppUrl(request: NextRequest): string {
  // IMPORTANT: Prefer the request host to ensure cookies are set on the correct domain
  // VERCEL_URL is deployment-specific and causes cookie domain mismatches
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

  console.log('[Auth Callback] Starting - APP_URL:', APP_URL);
  console.log('[Auth Callback] Has code:', !!code, 'Has error:', !!error);

  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${APP_URL}/login?error=${error}`);
  }

  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(`${APP_URL}/login?error=no_code`);
  }

  // Create a response that we'll add cookies to
  const redirectUrl = `${APP_URL}${next}`;
  let response = NextResponse.redirect(redirectUrl);

  // Create Supabase client that sets cookies on our response
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Exchange code for session - cookies will be set on the response
  console.log('Attempting to exchange code for session...');
  console.log('Code:', code?.substring(0, 10) + '...');

  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

  if (sessionError) {
    console.error('Session exchange error:', sessionError);
    console.error('Error details:', JSON.stringify(sessionError, null, 2));
    return NextResponse.redirect(`${APP_URL}/login?error=auth_failed&details=${encodeURIComponent(sessionError.message)}`);
  }

  console.log('Session exchange successful');
  console.log('Session exists:', !!sessionData?.session);
  console.log('User exists:', !!sessionData?.user);

  const { session, user } = sessionData;

  if (!session || !user) {
    console.error('No session or user after exchange');
    return NextResponse.redirect(`${APP_URL}/login?error=no_session`);
  }

  console.log('User ID:', user.id);
  console.log('User email:', user.email);

  // Get GitHub identity and access token from the session
  const githubIdentity = user.identities?.find(i => i.provider === 'github');
  const providerToken = session.provider_token;

  // Use GitHub username as the user ID (matches our schema)
  const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;

  if (!githubUsername) {
    console.error('No GitHub username found in user metadata');
    return response;
  }

  // Use service role client for database operations (bypasses RLS)
  const serviceClient = createServiceClient();

  // Upsert user record in our users table (using GitHub username as id)
  const { error: upsertError } = await serviceClient.from('users').upsert(
    {
      id: githubUsername,
      github_username: githubUsername,
      github_id: githubIdentity?.id,
      avatar_url: user.user_metadata?.avatar_url,
      display_name: user.user_metadata?.full_name || user.user_metadata?.name || githubUsername,
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
    console.log('User record created/updated for:', githubUsername);
  }

  // If we have a provider token (GitHub access token), store it encrypted
  if (providerToken && process.env.ENCRYPTION_KEY) {
    try {
      const encryptedToken = encryptToken(providerToken);

      const { error: tokenError } = await serviceClient.from('integration_connections').upsert(
        {
          user_id: githubUsername,
          provider: 'github',
          access_token: encryptedToken,
          metadata: {
            username: githubUsername,
            scopes: 'repo delete_repo user:email read:org',
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
        console.log('GitHub token stored for user:', githubUsername);
      }
    } catch (err) {
      console.error('Token encryption error:', err);
    }
  } else {
    console.log('No provider token available or encryption key missing');
    console.log('Provider token exists:', !!providerToken);
    console.log('Encryption key exists:', !!process.env.ENCRYPTION_KEY);
  }

  // Sync GitHub repos to database on login
  if (providerToken) {
    try {
      console.log('[Auth Callback] Starting repo sync for user:', githubUsername);
      await syncGitHubRepos(serviceClient, githubUsername, providerToken);
      console.log('[Auth Callback] Repo sync completed successfully');
    } catch (err) {
      console.error('[Auth Callback] Repo sync error:', err);
      // Don't fail auth if repo sync fails
    }
  } else {
    console.log('[Auth Callback] Skipping repo sync - no provider token');
  }

  console.log('[Auth Callback] Complete - redirecting to:', redirectUrl);
  return response;
}

/**
 * Fetch all GitHub repos (owned, collaborator, and org repos) and sync to database
 */
async function syncGitHubRepos(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  token: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  // Fetch user's repositories (owned + collaborator access)
  const userReposResponse = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
    { headers }
  );

  if (!userReposResponse.ok) {
    console.error('Failed to fetch user repos:', userReposResponse.status);
    return;
  }

  const userRepos = await userReposResponse.json();

  // Fetch user's organizations
  const orgsResponse = await fetch('https://api.github.com/user/orgs?per_page=100', { headers });
  const orgs = orgsResponse.ok ? await orgsResponse.json() : [];

  // Fetch repos for each org in parallel
  const orgRepoPromises = orgs.map((org: { login: string }) =>
    fetch(`https://api.github.com/orgs/${org.login}/repos?per_page=100&sort=updated`, { headers })
      .then(res => (res.ok ? res.json() : []))
      .catch(() => [])
  );

  const orgReposArrays = await Promise.all(orgRepoPromises);
  const orgRepos = orgReposArrays.flat();

  // Combine and deduplicate repos
  const allRepos = [...userRepos, ...orgRepos];
  const uniqueRepos = Array.from(
    new Map(allRepos.map((repo: { id: number }) => [repo.id, repo])).values()
  );

  console.log(`Found ${uniqueRepos.length} unique repos to sync`);

  if (uniqueRepos.length === 0) {
    return;
  }

  // Prepare repos for upsert
  const reposToUpsert = uniqueRepos.map((repo: any) => ({
    user_id: userId,
    repo_id: repo.id,
    repo_full_name: repo.full_name,
    repo_name: repo.name,
    is_private: repo.private || false,
    description: repo.description,
    language: repo.language,
    default_branch: repo.default_branch || 'main',
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    updated_at: new Date().toISOString(),
  }));

  // Upsert all repos to database
  const { error } = await serviceClient.from('user_repos').upsert(reposToUpsert as never[], {
    onConflict: 'user_id,repo_id',
  });

  if (error) {
    console.error('Repo upsert error:', error);
  } else {
    console.log(`Successfully synced ${reposToUpsert.length} repos for user ${userId}`);
  }
}
