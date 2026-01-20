import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RepoIntegration {
  vercel?: { projectId: string; projectName: string };
  supabase?: { projectRef: string; projectName: string };
}

interface RepoIntegrations {
  [repoFullName: string]: RepoIntegration;
}

interface RepoIntegrationRow {
  repo_full_name: string;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  supabase_project_ref: string | null;
}

// GET - retrieve associations for a repo
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const repo = searchParams.get('repo');

    if (repo) {
      // Return specific repo's integrations (use maybeSingle to handle no rows gracefully)
      const { data, error } = await serviceClient
        .from('repo_integrations')
        .select('vercel_project_id, vercel_project_name, supabase_project_ref')
        .eq('user_id', githubUsername)
        .eq('repo_full_name', repo)
        .maybeSingle();

      if (error) {
        console.error('Error fetching repo integrations:', error);
        return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
      }

      const row = data as { vercel_project_id: string | null; vercel_project_name: string | null; supabase_project_ref: string | null } | null;
      const integration: RepoIntegration = {};
      if (row?.vercel_project_id) {
        integration.vercel = { projectId: row.vercel_project_id, projectName: row.vercel_project_name || '' };
      }
      if (row?.supabase_project_ref) {
        integration.supabase = { projectRef: row.supabase_project_ref, projectName: '' };
      }

      return NextResponse.json({ integrations: integration });
    }

    // Return all integrations
    const { data, error } = await serviceClient
      .from('repo_integrations')
      .select('repo_full_name, vercel_project_id, vercel_project_name, supabase_project_ref')
      .eq('user_id', githubUsername);

    if (error) {
      console.error('Error fetching repo integrations:', error);
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
    }

    const rows = (data || []) as RepoIntegrationRow[];
    const integrations: RepoIntegrations = {};
    for (const row of rows) {
      const integration: RepoIntegration = {};
      if (row.vercel_project_id) {
        integration.vercel = { projectId: row.vercel_project_id, projectName: row.vercel_project_name || '' };
      }
      if (row.supabase_project_ref) {
        integration.supabase = { projectRef: row.supabase_project_ref, projectName: '' };
      }
      if (Object.keys(integration).length > 0) {
        integrations[row.repo_full_name] = integration;
      }
    }

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Error in GET /api/repos/integrations:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST - save an association
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    const body = await request.json();
    const { repo, vercel, supabase: supabaseProject } = body;

    if (!repo) {
      return NextResponse.json({ error: 'repo is required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Get existing integration (use maybeSingle to handle no rows gracefully)
    const { data: existingData } = await serviceClient
      .from('repo_integrations')
      .select('vercel_project_id, vercel_project_name, supabase_project_ref')
      .eq('user_id', githubUsername)
      .eq('repo_full_name', repo)
      .maybeSingle();

    const existing = existingData as { vercel_project_id: string | null; vercel_project_name: string | null; supabase_project_ref: string | null } | null;

    // Build update object
    const updates: Record<string, unknown> = {
      user_id: githubUsername,
      repo_full_name: repo,
      updated_at: new Date().toISOString(),
    };

    // Update vercel if provided
    if (vercel !== undefined) {
      updates.vercel_project_id = vercel === null ? null : vercel.projectId;
      updates.vercel_project_name = vercel === null ? null : vercel.projectName;
    } else if (existing?.vercel_project_id) {
      updates.vercel_project_id = existing.vercel_project_id;
      updates.vercel_project_name = existing.vercel_project_name;
    }

    // Update supabase if provided
    if (supabaseProject !== undefined) {
      updates.supabase_project_ref = supabaseProject === null ? null : supabaseProject.projectRef;
    } else if (existing?.supabase_project_ref) {
      updates.supabase_project_ref = existing.supabase_project_ref;
    }

    // Check if there's anything to save
    if (!updates.vercel_project_id && !updates.supabase_project_ref) {
      // Delete the row if both are null/empty
      await serviceClient
        .from('repo_integrations')
        .delete()
        .eq('user_id', githubUsername)
        .eq('repo_full_name', repo);

      return NextResponse.json({ success: true, integrations: {} });
    }

    // Upsert the integration
    const { error } = await serviceClient
      .from('repo_integrations')
      .upsert(updates as never, { onConflict: 'user_id,repo_full_name' });

    if (error) {
      console.error('Error saving repo integration:', error);
      return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
    }

    // Build response
    const integration: RepoIntegration = {};
    if (updates.vercel_project_id) {
      integration.vercel = { projectId: updates.vercel_project_id as string, projectName: (updates.vercel_project_name as string) || '' };
    }
    if (updates.supabase_project_ref) {
      integration.supabase = { projectRef: updates.supabase_project_ref as string, projectName: '' };
    }

    return NextResponse.json({ success: true, integrations: integration });
  } catch (error) {
    console.error('Error in POST /api/repos/integrations:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE - remove an association
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const githubUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (!githubUsername) {
      return NextResponse.json({ error: 'No GitHub username found' }, { status: 400 });
    }

    const body = await request.json();
    const { repo, service } = body;

    if (!repo || !service) {
      return NextResponse.json({ error: 'repo and service are required' }, { status: 400 });
    }

    if (service !== 'vercel' && service !== 'supabase') {
      return NextResponse.json({ error: 'service must be "vercel" or "supabase"' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Get existing integration (use maybeSingle to handle no rows gracefully)
    const { data: existingData } = await serviceClient
      .from('repo_integrations')
      .select('vercel_project_id, vercel_project_name, supabase_project_ref')
      .eq('user_id', githubUsername)
      .eq('repo_full_name', repo)
      .maybeSingle();

    const existing = existingData as { vercel_project_id: string | null; vercel_project_name: string | null; supabase_project_ref: string | null } | null;

    if (!existing) {
      return NextResponse.json({ success: true });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (service === 'vercel') {
      updates.vercel_project_id = null;
      updates.vercel_project_name = null;
      updates.supabase_project_ref = existing.supabase_project_ref;
    } else {
      updates.supabase_project_ref = null;
      updates.vercel_project_id = existing.vercel_project_id;
      updates.vercel_project_name = existing.vercel_project_name;
    }

    // If both are null, delete the row
    if (!updates.vercel_project_id && !updates.supabase_project_ref) {
      await serviceClient
        .from('repo_integrations')
        .delete()
        .eq('user_id', githubUsername)
        .eq('repo_full_name', repo);
    } else {
      // Update to remove just the specified service
      await serviceClient
        .from('repo_integrations')
        .update(updates as never)
        .eq('user_id', githubUsername)
        .eq('repo_full_name', repo);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/repos/integrations:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
