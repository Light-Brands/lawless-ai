import { NextResponse } from 'next/server';

export async function GET() {
  // Get backend URL from server-side env var (already configured)
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

  // Convert HTTP URL to WebSocket URL
  const wsUrl = backendUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');

  return NextResponse.json({ wsUrl });
}
