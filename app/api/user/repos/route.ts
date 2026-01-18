import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET: Fetch user's cached repos from database
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: repos, error } = await supabase
      .from('user_repos')
      .select('*')
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false });

    if (error) {
      console.error('Error fetching user repos:', error);
      return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 500 });
    }

    return NextResponse.json({ repos });
  } catch (error) {
    console.error('Error in GET /api/user/repos:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST: Sync repos to database (called after fetching from GitHub)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { repos } = await request.json();

    if (!repos || !Array.isArray(repos)) {
      return NextResponse.json({ error: 'Invalid repos data' }, { status: 400 });
    }

    // Use service client to bypass RLS for bulk upsert
    const serviceClient = createServiceClient();

    // Prepare repos for upsert
    const reposToUpsert = repos.map((repo: {
      id: number;
      fullName: string;
      name: string;
      private: boolean;
      description: string | null;
      language: string | null;
      defaultBranch: string;
      htmlUrl: string;
      cloneUrl: string;
    }) => ({
      user_id: user.id,
      repo_id: repo.id,
      repo_full_name: repo.fullName,
      repo_name: repo.name,
      is_private: repo.private || false,
      description: repo.description,
      language: repo.language,
      default_branch: repo.defaultBranch || 'main',
      html_url: repo.htmlUrl,
      clone_url: repo.cloneUrl,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await serviceClient
      .from('user_repos')
      .upsert(reposToUpsert as never[], {
        onConflict: 'user_id,repo_id',
      });

    if (error) {
      console.error('Error syncing repos:', error);
      return NextResponse.json({ error: 'Failed to sync repos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, synced: repos.length });
  } catch (error) {
    console.error('Error in POST /api/user/repos:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH: Update repo (mark as accessed, favorite, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { repoId, isFavorite, markAccessed } = await request.json();

    if (!repoId) {
      return NextResponse.json({ error: 'repoId required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (typeof isFavorite === 'boolean') {
      updates.is_favorite = isFavorite;
    }
    if (markAccessed) {
      updates.last_accessed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await serviceClient
      .from('user_repos')
      .update(updates as never)
      .eq('user_id', user.id)
      .eq('repo_id', repoId);

    if (error) {
      console.error('Error updating repo:', error);
      return NextResponse.json({ error: 'Failed to update repo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/user/repos:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
