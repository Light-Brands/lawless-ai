import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const token = request.cookies.get('supabase_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch project' },
        { status: response.status }
      );
    }

    const project = await response.json();

    return NextResponse.json({
      project: {
        id: project.id,
        ref: project.ref,
        name: project.name,
        organizationId: project.organization_id,
        region: project.region,
        createdAt: project.created_at,
        status: project.status,
        database: project.database,
      },
    });
  } catch (error) {
    console.error('Supabase project fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// Delete a Supabase project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const token = request.cookies.get('supabase_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 200 || response.status === 204) {
      // Clean up any repo integration associations that reference this project
      const existingIntegrations = request.cookies.get('repo_integrations')?.value;
      if (existingIntegrations) {
        try {
          const integrations = JSON.parse(existingIntegrations);
          let modified = false;

          for (const repoName of Object.keys(integrations)) {
            if (integrations[repoName].supabase?.projectRef === ref) {
              delete integrations[repoName].supabase;
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
      { error: error.message || 'Failed to delete project' },
      { status: response.status }
    );
  } catch (error) {
    console.error('Error deleting Supabase project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
