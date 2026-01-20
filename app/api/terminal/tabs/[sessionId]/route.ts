import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const apiKey = process.env.BACKEND_API_KEY;

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

// List terminal tabs for a session
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    const response = await fetch(
      `${backendUrl}/api/terminal/tabs/${sessionId}`,
      { headers: apiKey ? { 'X-API-Key': apiKey } : {} }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Terminal Tabs] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list terminal tabs' },
      { status: 500 }
    );
  }
}
