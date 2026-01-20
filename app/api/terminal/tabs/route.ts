import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const apiKey = process.env.BACKEND_API_KEY;

// Create terminal tab with isolated worktree
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${backendUrl}/api/terminal/tabs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Terminal Tabs] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create terminal tab' },
      { status: 500 }
    );
  }
}
