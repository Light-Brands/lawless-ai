import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  const apiKey = process.env.BACKEND_API_KEY;

  try {
    const response = await fetch(
      `${backendUrl}/api/preview/ports?sessionId=${sessionId}`,
      { headers: apiKey ? { 'X-API-Key': apiKey } : {} }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Preview Ports] Error:', error);
    return NextResponse.json({ ports: [], scannedAt: new Date().toISOString() });
  }
}
