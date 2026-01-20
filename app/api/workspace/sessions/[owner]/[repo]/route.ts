import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  const apiKey = process.env.BACKEND_API_KEY;

  try {
    const { owner, repo } = await params;

    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log(`[Sessions List] Calling backend: ${backendUrl}/api/workspace/sessions/${owner}/${repo} (userId: ${userId})`);

    // Pass userId to backend
    const url = new URL(`${backendUrl}/api/workspace/sessions/${owner}/${repo}`);
    if (userId) {
      url.searchParams.set('userId', userId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Sessions List] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: `Backend returned non-JSON response: ${text.substring(0, 100)}` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[Sessions List] Backend error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Sessions List] Error:', error.message);
    return NextResponse.json(
      {
        error: 'Failed to list sessions',
        details: error.message,
        backendUrl: backendUrl.replace(/\/\/.*@/, '//***@')
      },
      { status: 500 }
    );
  }
}
