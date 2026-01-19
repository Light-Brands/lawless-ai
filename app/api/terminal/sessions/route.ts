import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET: Fetch terminal sessions for a repo
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

    const { searchParams } = new URL(request.url);
    const repoFullName = searchParams.get('repo');

    if (!repoFullName) {
      return NextResponse.json({ error: 'Repo parameter required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Fetch sessions with their outputs
    const { data: sessions, error } = await serviceClient
      .from('terminal_sessions')
      .select(`
        id,
        session_id,
        repo_full_name,
        name,
        branch_name,
        base_branch,
        base_commit,
        created_at,
        last_accessed_at,
        terminal_outputs (
          output_lines
        )
      `)
      .eq('user_id', githubUsername)
      .eq('repo_full_name', repoFullName)
      .order('last_accessed_at', { ascending: false });

    if (error) {
      console.error('Error fetching terminal sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Transform to include outputs
    const sessionsWithOutputs = sessions?.map((session: any) => ({
      ...session,
      outputs: session.terminal_outputs?.[0]?.output_lines || [],
    })) || [];

    return NextResponse.json({ sessions: sessionsWithOutputs });
  } catch (error) {
    console.error('Error in GET /api/terminal/sessions:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST: Create or update a terminal session
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
    const { sessionId, repoFullName, name, branchName, baseBranch, baseCommit, outputs } = body;

    if (!sessionId || !repoFullName || !name) {
      return NextResponse.json({ error: 'sessionId, repoFullName, and name are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Upsert the session
    const { data: session, error: sessionError } = await serviceClient
      .from('terminal_sessions')
      .upsert({
        user_id: githubUsername,
        session_id: sessionId,
        repo_full_name: repoFullName,
        name,
        branch_name: branchName,
        base_branch: baseBranch || 'main',
        base_commit: baseCommit,
        last_accessed_at: new Date().toISOString(),
      } as never, {
        onConflict: 'user_id,session_id',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error upserting terminal session:', sessionError);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // If outputs provided, save them
    if (outputs && Array.isArray(outputs) && session) {
      const sessionData = session as { id: string };
      const { error: outputError } = await serviceClient
        .from('terminal_outputs')
        .upsert({
          terminal_session_id: sessionData.id,
          output_lines: outputs,
          updated_at: new Date().toISOString(),
        } as never, {
          onConflict: 'terminal_session_id',
        });

      if (outputError) {
        console.error('Error saving terminal outputs:', outputError);
        // Don't fail the whole request for output errors
      }
    }

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Error in POST /api/terminal/sessions:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE: Remove a terminal session
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Delete the session (outputs cascade delete)
    const { error } = await serviceClient
      .from('terminal_sessions')
      .delete()
      .eq('user_id', githubUsername)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error deleting terminal session:', error);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/terminal/sessions:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
