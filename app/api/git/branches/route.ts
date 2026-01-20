import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const apiKey = process.env.BACKEND_API_KEY;

// List available branches for worktree creation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/git/branches?sessionId=${sessionId}`,
      { headers: apiKey ? { 'X-API-Key': apiKey } : {} }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Git Branches] Error:', error);
    return NextResponse.json({ branches: ['main'] });
  }
}
