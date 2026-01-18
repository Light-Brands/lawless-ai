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

// Delete a Vercel project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Check for teamId in query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    const apiUrl = teamId
      ? `https://api.vercel.com/v9/projects/${id}?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${id}`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 204 || response.status === 200) {
      // Clean up any repo integration associations that reference this project
      const existingIntegrations = request.cookies.get('repo_integrations')?.value;
      if (existingIntegrations) {
        try {
          const integrations = JSON.parse(existingIntegrations);
          let modified = false;

          for (const repoName of Object.keys(integrations)) {
            if (integrations[repoName].vercel?.projectId === id) {
              delete integrations[repoName].vercel;
              modified = true;
            }
          }

          if (modified) {
            const res = NextResponse.json({ success: true });
            res.cookies.set('repo_integrations', JSON.stringify(integrations), {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 365,
              path: '/',
            });
            return res;
          }
        } catch {
          // Ignore cookie parse errors
        }
      }

      return NextResponse.json({ success: true });
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: 'Permission denied. You may not have access to delete this project.' },
        { status: 403 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.error?.message || 'Failed to delete project' },
      { status: response.status }
    );
  } catch (error) {
    console.error('Error deleting Vercel project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
