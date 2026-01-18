import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.vercel.com/v9/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch projects' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const projects = data.projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      framework: project.framework,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      latestDeployment: project.latestDeployments?.[0] ? {
        id: project.latestDeployments[0].id,
        url: project.latestDeployments[0].url,
        state: project.latestDeployments[0].state,
        createdAt: project.latestDeployments[0].createdAt,
      } : null,
      targets: project.targets,
      link: project.link ? {
        type: project.link.type,
        repo: project.link.repo,
        repoId: project.link.repoId,
        org: project.link.org,
      } : null,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Vercel projects fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}
