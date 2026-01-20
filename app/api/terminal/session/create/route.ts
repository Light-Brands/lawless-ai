import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoFullName, sessionId, baseBranch } = body;

    if (!repoFullName || !sessionId) {
      return NextResponse.json(
        { error: 'Repository name and session ID required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const apiKey = process.env.BACKEND_API_KEY;

    const response = await fetch(`${backendUrl}/api/terminal/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ repoFullName, sessionId, baseBranch }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating terminal session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
