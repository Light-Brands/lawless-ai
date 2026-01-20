import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const path = searchParams.get('path') || '';
  const ref = searchParams.get('ref'); // branch/commit ref

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
  }

  try {
    let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
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
        return NextResponse.json({ error: 'Path not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if it's a file or directory
    if (Array.isArray(data)) {
      // Directory listing
      const contents = data.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type, // 'file' or 'dir'
        size: item.size,
        sha: item.sha,
      }));

      // Sort: directories first, then files, both alphabetically
      contents.sort((a: any, b: any) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'dir' ? -1 : 1;
      });

      return NextResponse.json({
        type: 'dir',
        contents,
      });
    } else {
      // Single file
      return NextResponse.json({
        type: 'file',
        file: {
          name: data.name,
          path: data.path,
          size: data.size,
          sha: data.sha,
          content: data.content, // Base64 encoded
          encoding: data.encoding,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching contents:', error);
    return NextResponse.json({ error: 'Failed to fetch contents' }, { status: 500 });
  }
}
