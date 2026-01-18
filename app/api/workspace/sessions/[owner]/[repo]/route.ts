import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiKey = process.env.BACKEND_API_KEY;

    const response = await fetch(`${backendUrl}/api/workspace/sessions/${owner}/${repo}`, {
      headers: {
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error listing workspace sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}
