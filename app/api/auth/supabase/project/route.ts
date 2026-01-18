import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ProjectCredentials {
  name: string;
  url: string;
  serviceKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url, serviceKey, name } = await request.json();

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'URL and service key are required' }, { status: 400 });
    }

    // Verify credentials by making a test request
    const testRes = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    if (!testRes.ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Get existing projects from cookie
    const existingProjectsCookie = request.cookies.get('supabase_projects')?.value;
    let projects: ProjectCredentials[] = [];

    if (existingProjectsCookie) {
      try {
        projects = JSON.parse(existingProjectsCookie);
      } catch (e) {
        projects = [];
      }
    }

    // Extract project ref from URL
    const urlObj = new URL(url);
    const projectRef = urlObj.hostname.split('.')[0];

    // Add or update project
    const existingIndex = projects.findIndex(p => p.url === url);
    const newProject: ProjectCredentials = {
      name: name || projectRef,
      url,
      serviceKey,
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = newProject;
    } else {
      projects.push(newProject);
    }

    const response = NextResponse.json({
      success: true,
      projectCount: projects.length,
    });

    // Store projects in cookie
    response.cookies.set('supabase_projects', JSON.stringify(projects), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Supabase project auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
