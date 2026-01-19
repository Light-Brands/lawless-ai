import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const { message, sessionId, conversationId } = await request.json();

  // Get GitHub username from cookie for database persistence
  const githubUser = request.cookies.get('github_user')?.value;
  const githubToken = request.cookies.get('github_token')?.value;

  console.log(`[Frontend Chat] Cookies - github_user: ${githubUser || 'NOT SET'}, github_token: ${githubToken ? 'SET' : 'NOT SET'}`);

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Proxy request to the backend server
    const backendResponse = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({
        message,
        sessionId,
        conversationId,
        userId: githubUser, // Pass GitHub username for Supabase persistence
      }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      return new Response(JSON.stringify({ error: `Backend error: ${error}` }), {
        status: backendResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response back to the client
    return new Response(backendResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Backend connection error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to backend server' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
