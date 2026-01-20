import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  const apiKey = process.env.BACKEND_API_KEY;

  try {
    const body = await request.json();
    const { repoFullName, sessionId, sessionName, baseBranch, userId } = body;

    if (!repoFullName || !sessionId || !sessionName) {
      return NextResponse.json(
        { error: 'Repository name, session ID, and session name required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required for session creation' },
        { status: 400 }
      );
    }

    console.log(`[Session Create] Calling backend: ${backendUrl}/api/workspace/session/create (userId: ${userId})`);

    const response = await fetch(`${backendUrl}/api/workspace/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ repoFullName, sessionId, sessionName, baseBranch, userId }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Session Create] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: `Backend returned non-JSON response: ${text.substring(0, 100)}` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[Session Create] Backend error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Session Create] Error:', error.message);
    return NextResponse.json(
      {
        error: 'Failed to create session',
        details: error.message,
        backendUrl: backendUrl.replace(/\/\/.*@/, '//***@') // Hide credentials if any
      },
      { status: 500 }
    );
  }
}
