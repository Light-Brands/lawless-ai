import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  if (!message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  try {
    // Send to backend demo chat endpoint
    const response = await fetch(`${BACKEND_URL}/api/demo/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Demo chat error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
