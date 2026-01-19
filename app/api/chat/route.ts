import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const { message, sessionId, conversationId } = await request.json();

  // Get GitHub username from cookie (direct OAuth) or Supabase Auth
  let githubUser = request.cookies.get('github_user')?.value;

  // If no direct OAuth cookie, try Supabase Auth
  if (!githubUser) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get GitHub username from user metadata or email
        githubUser = user.user_metadata?.user_name ||
                     user.user_metadata?.preferred_username ||
                     user.email?.split('@')[0];
      }
    } catch (e) {
      console.error('Error getting Supabase user:', e);
    }
  }

  console.log(`[Frontend Chat] userId resolved to: ${githubUser || 'none'}`);

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
