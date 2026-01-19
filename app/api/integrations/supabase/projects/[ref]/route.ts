import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const token = await getIntegrationToken('supabase_pat');

  if (!token) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
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
  const token = await getIntegrationToken('supabase_pat');

  if (!token) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  // Get current user for database operations
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 200 || response.status === 204) {
      // Clean up any repo integration associations that reference this project in database
      if (githubUsername) {
        try {
          const serviceClient = createServiceClient();
          await serviceClient
            .from('repo_integrations')
            .update({ supabase_project_ref: null, updated_at: new Date().toISOString() } as never)
            .eq('user_id', githubUsername)
            .eq('supabase_project_ref', ref);
        } catch (dbError) {
          console.error('Error cleaning up repo integrations:', dbError);
          // Continue anyway - the Supabase project was deleted
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
