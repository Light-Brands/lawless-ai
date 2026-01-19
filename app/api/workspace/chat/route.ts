import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const { message, repoFullName, sessionId, workspaceSessionId, conversationId } = await request.json();

  // Get GitHub token from database
  const token = await getIntegrationToken('github');

  // Get GitHub username from Supabase Auth
  let githubUser: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      githubUser = user.user_metadata?.user_name ||
                   user.user_metadata?.preferred_username ||
                   user.email?.split('@')[0];
    }
  } catch (e) {
    console.error('Error getting Supabase user:', e);
  }

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  if (!message || !repoFullName) {
    return NextResponse.json({ error: 'Message and repository required' }, { status: 400 });
  }

  try {
    // Send to backend for workspace chat
    const response = await fetch(`${BACKEND_URL}/api/workspace/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({
        message,
        repoFullName,
        sessionId,
        workspaceSessionId,
        conversationId,
        githubToken: token,
        userId: githubUser, // Pass GitHub username for Supabase persistence
      }),
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
    console.error('Workspace chat error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
