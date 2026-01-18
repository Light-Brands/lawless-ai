import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      if (response.status === 404) {
        return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repoData = await response.json();

    return NextResponse.json({
      repo: {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        private: repoData.private,
        description: repoData.description,
        language: repoData.language,
        defaultBranch: repoData.default_branch,
        updatedAt: repoData.updated_at,
        createdAt: repoData.created_at,
        stargazersCount: repoData.stargazers_count,
        forksCount: repoData.forks_count,
        watchersCount: repoData.watchers_count,
        openIssuesCount: repoData.open_issues_count,
        htmlUrl: repoData.html_url,
        cloneUrl: repoData.clone_url,
        owner: {
          login: repoData.owner.login,
          avatarUrl: repoData.owner.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching repo:', error);
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 });
  }
}
