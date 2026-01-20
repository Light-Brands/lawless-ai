import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

// Get a specific workspace session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const response = await fetch(`${BACKEND_URL}/api/workspace/session/${sessionId}`, {
      headers: {
        ...(BACKEND_API_KEY ? { 'X-API-Key': BACKEND_API_KEY } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting workspace session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// Rename a workspace session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/api/workspace/session/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY ? { 'X-API-Key': BACKEND_API_KEY } : {}),
      },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error renaming workspace session:', error);
    return NextResponse.json(
      { error: 'Failed to rename session' },
      { status: 500 }
    );
  }
}

// Delete a workspace session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get('repo');

    if (!repoFullName) {
      return NextResponse.json({ error: 'Repository name required' }, { status: 400 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/workspace/session/${sessionId}?repoFullName=${encodeURIComponent(repoFullName)}`,
      {
        method: 'DELETE',
        headers: {
          ...(BACKEND_API_KEY ? { 'X-API-Key': BACKEND_API_KEY } : {}),
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error deleting workspace session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
