import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { repoFullName } = await request.json();

  if (!repoFullName) {
    return NextResponse.json({ error: 'Repository required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/workspace/git/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({
        repoFullName,
        githubToken: token,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : 400 });
  } catch (error) {
    console.error('Git push error:', error);
    return NextResponse.json({ error: 'Failed to push' }, { status: 502 });
  }
}
