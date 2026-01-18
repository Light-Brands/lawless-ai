import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch(`https://api.vercel.com/v9/projects/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch project' },
        { status: response.status }
      );
    }

    const project = await response.json();

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        framework: project.framework,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        targets: project.targets,
        latestDeployments: project.latestDeployments?.map((d: any) => ({
          id: d.id,
          url: d.url,
          state: d.state,
          createdAt: d.createdAt,
          target: d.target,
        })),
        link: project.link ? {
          type: project.link.type,
          repo: project.link.repo,
          repoId: project.link.repoId,
          org: project.link.org,
        } : null,
        env: project.env?.map((e: any) => ({
          key: e.key,
          target: e.target,
          type: e.type,
        })),
      },
    });
  } catch (error) {
    console.error('Vercel project fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
