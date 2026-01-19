import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

// Delete a repository
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const token = await getGitHubToken();
  const { owner, repo } = await params;

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  // Get current user for database operations
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 204) {
      // Also clean up any integration associations from database
      if (githubUsername) {
        try {
          const serviceClient = createServiceClient();
          const fullName = `${owner}/${repo}`;
          await serviceClient
            .from('repo_integrations')
            .delete()
            .eq('user_id', githubUsername)
            .eq('repo_full_name', fullName);
        } catch (dbError) {
          console.error('Error cleaning up repo integrations:', dbError);
          // Continue anyway - the repo was deleted
        }
      }
      return NextResponse.json({ success: true });
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: 'Permission denied. You may not have admin access to this repository.' },
        { status: 403 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.message || 'Failed to delete repository' },
      { status: response.status }
    );
  } catch (error) {
    console.error('Error deleting repository:', error);
    return NextResponse.json({ error: 'Failed to delete repository' }, { status: 500 });
  }
}

// Update repository (visibility, description, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const token = await getGitHubToken();
  const { owner, repo } = await params;

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Please connect your GitHub account.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { visibility, description, name } = body;

    // Build update payload - only include fields that are provided
    const updatePayload: Record<string, unknown> = {};

    if (visibility !== undefined) {
      // GitHub API uses 'private' boolean, not 'visibility' string for user repos
      updatePayload.private = visibility === 'private';
    }

    if (description !== undefined) {
      updatePayload.description = description;
    }

    if (name !== undefined) {
      updatePayload.name = name;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Permission denied. You may not have admin access to this repository.' },
          { status: 403 }
        );
      }

      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || 'Failed to update repository' },
        { status: response.status }
      );
    }

    const updatedRepo = await response.json();
    return NextResponse.json({
      success: true,
      repo: {
        id: updatedRepo.id,
        name: updatedRepo.name,
        fullName: updatedRepo.full_name,
        private: updatedRepo.private,
        description: updatedRepo.description,
        htmlUrl: updatedRepo.html_url,
      },
    });
  } catch (error) {
    console.error('Error updating repository:', error);
    return NextResponse.json({ error: 'Failed to update repository' }, { status: 500 });
  }
}
