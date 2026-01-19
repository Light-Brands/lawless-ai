import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/encryption';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get the current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get GitHub username as user_id (matches our schema)
    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    // Verify token by fetching projects
    const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!projectsRes.ok) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const projects = await projectsRes.json();
    const projectCount = Array.isArray(projects) ? projects.length : 0;

    // Store encrypted token in database
    if (process.env.ENCRYPTION_KEY) {
      const serviceClient = createServiceClient();
      const encryptedToken = encryptToken(token);

      const { error: dbError } = await serviceClient.from('integration_connections').upsert(
        {
          user_id: githubUsername,
          provider: 'supabase_pat',
          access_token: encryptedToken,
          metadata: {
            projectCount,
          },
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,provider' }
      );

      if (dbError) {
        console.error('Failed to store Supabase token in database:', dbError);
        // Continue anyway - cookies will work as fallback
      }
    }

    const response = NextResponse.json({
      success: true,
      projectCount,
    });

    // Store token in cookie as fallback
    response.cookies.set('supabase_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Supabase auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
