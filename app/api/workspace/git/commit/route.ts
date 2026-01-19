import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  const { repoFullName, message } = await request.json();

  if (!repoFullName || !message) {
    return NextResponse.json({ error: 'Repository and message required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/workspace/git/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({
        repoFullName,
        message,
        githubToken: token,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : 400 });
  } catch (error) {
    console.error('Git commit error:', error);
    return NextResponse.json({ error: 'Failed to commit' }, { status: 502 });
  }
}
