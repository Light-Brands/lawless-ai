import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = await getGitHubToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Fetch user info first
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: userRes.status });
    }

    const user = await userRes.json();

    // Fetch organizations the user belongs to
    const orgsRes = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!orgsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: orgsRes.status });
    }

    const orgs = await orgsRes.json();

    // Return personal account + organizations
    const accounts = [
      {
        login: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        type: 'personal',
      },
      ...orgs.map((org: { login: string; avatar_url: string }) => ({
        login: org.login,
        name: org.login,
        avatarUrl: org.avatar_url,
        type: 'organization',
      })),
    ];

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching GitHub orgs:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
