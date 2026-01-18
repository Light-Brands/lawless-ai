import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get('repo');

    if (!repoFullName) {
      return NextResponse.json(
        { error: 'Repository name required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiKey = process.env.BACKEND_API_KEY;

    const response = await fetch(
      `${backendUrl}/api/terminal/session/${sessionId}?repoFullName=${encodeURIComponent(repoFullName)}`,
      {
        method: 'DELETE',
        headers: {
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error deleting terminal session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get('repo');

    if (!repoFullName) {
      return NextResponse.json(
        { error: 'Repository name required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiKey = process.env.BACKEND_API_KEY;

    // This would get session info - for now we return from the sessions list
    const [owner, repo] = repoFullName.split('/');
    const response = await fetch(
      `${backendUrl}/api/terminal/sessions/${owner}/${repo}`,
      {
        headers: {
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Find the specific session
    const session = data.sessions?.find((s: any) => s.sessionId === sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Error getting terminal session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
