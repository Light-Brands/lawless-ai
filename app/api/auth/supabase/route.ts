import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
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

    const response = NextResponse.json({
      success: true,
      projectCount: Array.isArray(projects) ? projects.length : 0,
    });

    // Store token in cookie
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
