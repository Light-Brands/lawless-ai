import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function GET(request: NextRequest) {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repoFullName = searchParams.get('repo');

  if (!repoFullName) {
    return NextResponse.json({ error: 'Repository required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/workspace/git/status?repo=${encodeURIComponent(repoFullName)}`,
      {
        headers: {
          'X-API-Key': BACKEND_API_KEY,
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Git status error:', error);
    return NextResponse.json({ error: 'Failed to get git status' }, { status: 502 });
  }
}
