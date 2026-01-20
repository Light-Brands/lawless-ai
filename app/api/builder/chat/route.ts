import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BuilderType } from '@/app/types/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

export async function POST(request: NextRequest) {
  const { message, brandName, builderType, history } = await request.json() as {
    message: string;
    brandName: string;
    builderType: BuilderType;
    history?: Array<{ role: string; content: string }>;
  };

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

  if (!message || !brandName || !builderType) {
    return NextResponse.json(
      { error: 'Message, brandName, and builderType are required' },
      { status: 400 }
    );
  }

  try {
    // Proxy request to the backend server
    const backendResponse = await fetch(`${BACKEND_URL}/api/builder/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BACKEND_API_KEY,
      },
      body: JSON.stringify({
        message,
        brandName,
        builderType,
        history,
        userId: githubUser,
      }),
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      return NextResponse.json(
        { error: `Backend error: ${error}` },
        { status: backendResponse.status }
      );
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
    console.error('Builder chat backend error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend server' },
      { status: 502 }
    );
  }
}
