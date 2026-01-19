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

  const { repoFullName } = await request.json();

  if (!repoFullName) {
    return NextResponse.json({ error: 'Repository name required' }, { status: 400 });
  }

  try {
    // Send to backend to clone/setup workspace
    const response = await fetch(`${BACKEND_URL}/api/workspace/setup`, {
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

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to setup workspace' }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Workspace setup error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
