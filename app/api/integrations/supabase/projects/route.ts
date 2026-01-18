import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('supabase_token')?.value;
  const projectsCookie = request.cookies.get('supabase_projects')?.value;

  // If using PAT, fetch from Management API
  if (token) {
    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: response.status });
      }

      const data = await response.json();

      const projects = data.map((project: any) => ({
        id: project.id,
        ref: project.ref,
        name: project.name,
        organizationId: project.organization_id,
        region: project.region,
        createdAt: project.created_at,
        status: project.status,
        databaseHost: project.database?.host,
      }));

      return NextResponse.json({ projects, source: 'pat' });
    } catch (error) {
      console.error('Supabase projects fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
  }

  // If using project credentials
  if (projectsCookie) {
    try {
      const projects = JSON.parse(projectsCookie);
      return NextResponse.json({
        projects: projects.map((p: any, index: number) => ({
          id: index.toString(),
          ref: new URL(p.url).hostname.split('.')[0],
          name: p.name,
          url: p.url,
        })),
        source: 'credentials',
      });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid projects data' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
