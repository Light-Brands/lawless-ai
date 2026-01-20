import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getTerminalSession,
  getTerminalOutput,
  saveTerminalOutput,
} from '@/lib/supabase/services/terminal-sessions';

// GET - Retrieve terminal output for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const repoFullName = searchParams.get('repoFullName');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the terminal session by session_id string
    const session = await getTerminalSession(supabase, sessionId);
    if (!session) {
      return NextResponse.json({ outputLines: [] });
    }

    // Get the output using the UUID
    const output = await getTerminalOutput(supabase, session.id);

    return NextResponse.json({
      outputLines: output?.output_lines || [],
      updatedAt: output?.updated_at,
    });
  } catch (error) {
    console.error('Error getting terminal output:', error);
    return NextResponse.json({ error: 'Failed to get terminal output' }, { status: 500 });
  }
}

// POST - Save terminal output for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, repoFullName, outputLines } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (!Array.isArray(outputLines)) {
      return NextResponse.json({ error: 'Output lines must be an array' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the terminal session by session_id string
    let session = await getTerminalSession(supabase, sessionId);

    // If session doesn't exist, we can't save output
    // The session should be created when the terminal connects
    if (!session) {
      // Try to create a minimal session record for output storage
      const { data: newSession, error: createError } = await supabase
        .from('terminal_sessions')
        .insert({
          session_id: sessionId,
          repo_full_name: repoFullName || 'unknown',
          name: `Session ${sessionId.slice(0, 8)}`,
          base_branch: 'main',
        } as never)
        .select()
        .single();

      if (createError) {
        console.error('Error creating terminal session for output:', createError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }

      session = newSession;
    }

    // Save the output
    const success = await saveTerminalOutput(supabase, session.id, outputLines);

    if (!success) {
      return NextResponse.json({ error: 'Failed to save terminal output' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving terminal output:', error);
    return NextResponse.json({ error: 'Failed to save terminal output' }, { status: 500 });
  }
}
