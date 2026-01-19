import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';

export const runtime = 'nodejs';

// Parse Link header to extract next page URL
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repo = searchParams.get('repo');

  if (!repo) {
    return NextResponse.json({ error: 'Repository required' }, { status: 400 });
  }

  try {
    const allBranches: { name: string; protected: boolean }[] = [];
    let url: string | null = `https://api.github.com/repos/${repo}/branches?per_page=100`;

    // Paginate through all branches
    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return NextResponse.json(
          { error: error.message || 'Failed to fetch branches' },
          { status: response.status }
        );
      }

      const branches = await response.json();
      allBranches.push(...branches.map((branch: { name: string; protected: boolean }) => ({
        name: branch.name,
        protected: branch.protected,
      })));

      // Check for next page
      url = getNextPageUrl(response.headers.get('Link'));
    }

    // Sort branches: main/master first, then alphabetically
    allBranches.sort((a, b) => {
      if (a.name === 'main') return -1;
      if (b.name === 'main') return 1;
      if (a.name === 'master') return -1;
      if (b.name === 'master') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ branches: allBranches });
  } catch (error) {
    console.error('Branches fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}
