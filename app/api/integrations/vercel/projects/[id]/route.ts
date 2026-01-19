import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
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
          state: d.state || d.readyState,
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
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  // Get current user for database operations
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;

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
      // Clean up any repo integration associations that reference this project in database
      if (githubUsername) {
        try {
          const serviceClient = createServiceClient();
          // Find and update any repo_integrations that reference this Vercel project
          await serviceClient
            .from('repo_integrations')
            .update({ vercel_project_id: null, updated_at: new Date().toISOString() } as never)
            .eq('user_id', githubUsername)
            .eq('vercel_project_id', id);
        } catch (dbError) {
          console.error('Error cleaning up repo integrations:', dbError);
          // Continue anyway - the Vercel project was deleted
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
