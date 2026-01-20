import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const apiKey = process.env.BACKEND_API_KEY;

interface RouteContext {
  params: Promise<{ sessionId: string; tabId: string }>;
}

// Delete terminal tab and cleanup worktree
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId, tabId } = await context.params;

    const response = await fetch(
      `${backendUrl}/api/terminal/tabs/${sessionId}/${tabId}`,
      {
        method: 'DELETE',
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Terminal Tabs] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete terminal tab' },
      { status: 500 }
    );
  }
}

// Update terminal tab (name, focus time)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId, tabId } = await context.params;
    const body = await request.json();

    const response = await fetch(
      `${backendUrl}/api/terminal/tabs/${sessionId}/${tabId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Terminal Tabs] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update terminal tab' },
      { status: 500 }
    );
  }
}
