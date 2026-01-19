import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (!user || !session) {
      return NextResponse.json({ error: 'Not authenticated', userError, sessionError }, { status: 401 });
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json({ error: 'No provider token available' }, { status: 400 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    // Fetch repos from GitHub
    const headers = {
      Authorization: `Bearer ${providerToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    const userReposResponse = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
      { headers }
    );

    if (!userReposResponse.ok) {
      const errorText = await userReposResponse.text();
      return NextResponse.json({
        error: 'Failed to fetch repos from GitHub',
        status: userReposResponse.status,
        details: errorText
      }, { status: 500 });
    }

    const userRepos = await userReposResponse.json();

    // Fetch orgs
    const orgsResponse = await fetch('https://api.github.com/user/orgs?per_page=100', { headers });
    const orgs = orgsResponse.ok ? await orgsResponse.json() : [];

    // Fetch org repos
    const orgRepoPromises = orgs.map((org: { login: string }) =>
      fetch(`https://api.github.com/orgs/${org.login}/repos?per_page=100&sort=updated`, { headers })
        .then(res => (res.ok ? res.json() : []))
        .catch(() => [])
    );

    const orgReposArrays = await Promise.all(orgRepoPromises);
    const orgRepos = orgReposArrays.flat();

    // Combine and dedupe
    const allRepos = [...userRepos, ...orgRepos];
    const uniqueRepos = Array.from(
      new Map(allRepos.map((repo: { id: number }) => [repo.id, repo])).values()
    );

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    // First ensure user exists
    const { error: userUpsertError } = await serviceClient.from('users').upsert(
      {
        id: githubUsername,
        github_username: githubUsername,
        avatar_url: user.user_metadata?.avatar_url,
        display_name: user.user_metadata?.full_name || githubUsername,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'id' }
    );

    if (userUpsertError) {
      return NextResponse.json({ error: 'User upsert failed', details: userUpsertError }, { status: 500 });
    }

    // Prepare repos for upsert
    const reposToUpsert = uniqueRepos.map((repo: any) => ({
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
      updated_at: new Date().toISOString(),
    }));

    // Upsert repos
    const { error: repoError } = await serviceClient.from('user_repos').upsert(
      reposToUpsert as never[],
      { onConflict: 'user_id,repo_id' }
    );

    if (repoError) {
      return NextResponse.json({ error: 'Repo upsert failed', details: repoError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId: githubUsername,
      repoCount: reposToUpsert.length,
      sampleRepos: reposToUpsert.slice(0, 5).map((r: any) => r.repo_full_name),
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
