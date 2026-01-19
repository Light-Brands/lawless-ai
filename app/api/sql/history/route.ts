import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET: Fetch SQL query history for a project
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
    const projectRef = searchParams.get('projectRef');

    if (!projectRef) {
      return NextResponse.json({ error: 'projectRef parameter required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: history, error } = await serviceClient
      .from('sql_query_history')
      .select('id, query, success, row_count, execution_time_ms, created_at')
      .eq('user_id', githubUsername)
      .eq('project_ref', projectRef)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching SQL history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error('Error in GET /api/sql/history:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST: Add a query to history
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
    const { projectRef, query, success, rowCount, executionTimeMs } = body;

    if (!projectRef || !query) {
      return NextResponse.json({ error: 'projectRef and query are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from('sql_query_history')
      .insert({
        user_id: githubUsername,
        project_ref: projectRef,
        query,
        success: success ?? true,
        row_count: rowCount,
        execution_time_ms: executionTimeMs,
      } as never);

    if (error) {
      console.error('Error saving SQL history:', error);
      return NextResponse.json({ error: 'Failed to save history' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/sql/history:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE: Clear history for a project
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
    const projectRef = searchParams.get('projectRef');

    if (!projectRef) {
      return NextResponse.json({ error: 'projectRef parameter required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from('sql_query_history')
      .delete()
      .eq('user_id', githubUsername)
      .eq('project_ref', projectRef);

    if (error) {
      console.error('Error clearing SQL history:', error);
      return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sql/history:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
