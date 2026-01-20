import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/encryption';

export const runtime = 'nodejs';

// POST: Sync repos from GitHub to database
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use GitHub username as user_id (matches our schema)
    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    // Get the stored GitHub token
    const serviceClient = createServiceClient();
    const { data: connection, error: connectionError } = await serviceClient
      .from('integration_connections')
      .select('access_token')
      .eq('user_id', githubUsername)
      .eq('provider', 'github')
      .single();

    const connectionData = connection as { access_token: string } | null;

    if (connectionError || !connectionData?.access_token) {
      return NextResponse.json(
        { error: 'No GitHub token found. Please re-authenticate.' },
        { status: 401 }
      );
    }

    // Decrypt the token
    let token: string;
    try {
      token = decryptToken(connectionData.access_token);
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt GitHub token. Please re-authenticate.' },
        { status: 401 }
      );
    }

    // Fetch repos from GitHub
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
      const errorText = await userReposResponse.text();
      console.error('Failed to fetch user repos:', userReposResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch repos from GitHub' },
        { status: 500 }
      );
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

    console.log(`[Repo Sync] Found ${uniqueRepos.length} unique repos for ${githubUsername}`);

    if (uniqueRepos.length === 0) {
      return NextResponse.json({ repos: [], synced: 0 });
    }

    // Get existing repos to preserve favorites
    const { data: existingRepos } = await serviceClient
      .from('user_repos')
      .select('repo_id, is_favorite, last_accessed_at')
      .eq('user_id', githubUsername);

    const existingMap = new Map(
      (existingRepos || []).map((r: { repo_id: number; is_favorite?: boolean; last_accessed_at?: string }) => [
        r.repo_id,
        { is_favorite: r.is_favorite, last_accessed_at: r.last_accessed_at }
      ])
    );

    // Prepare repos for upsert - preserve favorites and last_accessed_at
    const reposToUpsert = uniqueRepos.map((repo: any) => {
      const existing = existingMap.get(repo.id);
      return {
        user_id: githubUsername,
        repo_id: repo.id,
        repo_full_name: repo.full_name,
        repo_name: repo.name,
        is_private: repo.private || false,
        description: repo.description,
        language: repo.language,
        default_branch: repo.default_branch || 'main',
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        is_favorite: existing?.is_favorite || false,
        last_accessed_at: existing?.last_accessed_at || null,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert all repos to database
    const { error: upsertError } = await serviceClient
      .from('user_repos')
      .upsert(reposToUpsert as never[], {
        onConflict: 'user_id,repo_id',
      });

    if (upsertError) {
      console.error('[Repo Sync] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save repos' }, { status: 500 });
    }

    // Return the synced repos
    const { data: repos } = await serviceClient
      .from('user_repos')
      .select('*')
      .eq('user_id', githubUsername)
      .order('last_accessed_at', { ascending: false, nullsFirst: false });

    return NextResponse.json({
      repos: repos || [],
      synced: reposToUpsert.length,
    });
  } catch (error) {
    console.error('Error in POST /api/user/repos/sync:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
