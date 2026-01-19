import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref'); // branch/commit ref

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
  }

  try {
    let url = `https://api.github.com/repos/${owner}/${repo}/readme`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await fetch(url, {
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
        // No README found - this is not an error
        return NextResponse.json({ readme: null });
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // Decode the base64 content
    const content = data.content
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : '';

    return NextResponse.json({
      readme: {
        name: data.name,
        path: data.path,
        content,
        htmlUrl: data.html_url,
      },
    });
  } catch (error) {
    console.error('Error fetching readme:', error);
    return NextResponse.json({ error: 'Failed to fetch README' }, { status: 500 });
  }
}
