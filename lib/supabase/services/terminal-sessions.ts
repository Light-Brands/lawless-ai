import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TerminalSession, TerminalOutput } from '@/types/database';

export type TerminalSessionInput = {
  sessionId: string;
  repoFullName: string;
  name: string;
  branchName?: string;
  baseBranch?: string;
  baseCommit?: string;
};

export async function createTerminalSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: TerminalSessionInput
): Promise<TerminalSession | null> {
  const { data, error } = await supabase
    .from('terminal_sessions')
    .insert({
      user_id: userId,
      session_id: input.sessionId,
      repo_full_name: input.repoFullName,
      name: input.name,
      branch_name: input.branchName,
      base_branch: input.baseBranch || 'main',
      base_commit: input.baseCommit,
    } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating terminal session:', error);
    return null;
  }

  return data as TerminalSession;
}

export async function getTerminalSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<TerminalSession | null> {
  const { data, error } = await supabase
    .from('terminal_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching terminal session:', error);
    }
    return null;
  }

  return data as TerminalSession;
}

export async function listTerminalSessions(
  supabase: SupabaseClient<Database>,
  repoFullName: string
): Promise<TerminalSession[]> {
  const { data, error } = await supabase
    .from('terminal_sessions')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .order('last_accessed_at', { ascending: false });

  if (error) {
    console.error('Error listing terminal sessions:', error);
    return [];
  }

  return (data as TerminalSession[]) || [];
}

export async function updateTerminalSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  updates: Partial<{
    name: string;
    branch_name: string;
    last_accessed_at: string;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('terminal_sessions')
    .update({
      ...updates,
      last_accessed_at: updates.last_accessed_at || new Date().toISOString(),
    } as never)
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error updating terminal session:', error);
    return false;
  }

  return true;
}

export async function deleteTerminalSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<boolean> {
  // Delete associated outputs first (cascade should handle this, but be explicit)
  const session = await getTerminalSession(supabase, sessionId);
  if (session) {
    await supabase
      .from('terminal_outputs')
      .delete()
      .eq('terminal_session_id', session.id);
  }

  const { error } = await supabase
    .from('terminal_sessions')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error deleting terminal session:', error);
    return false;
  }

  return true;
}

export async function touchTerminalSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<void> {
  await supabase
    .from('terminal_sessions')
    .update({ last_accessed_at: new Date().toISOString() } as never)
    .eq('session_id', sessionId);
}

// Terminal Outputs

export async function getTerminalOutput(
  supabase: SupabaseClient<Database>,
  terminalSessionId: string
): Promise<TerminalOutput | null> {
  const { data, error } = await supabase
    .from('terminal_outputs')
    .select('*')
    .eq('terminal_session_id', terminalSessionId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching terminal output:', error);
    }
    return null;
  }

  return data as TerminalOutput;
}

export async function saveTerminalOutput(
  supabase: SupabaseClient<Database>,
  terminalSessionId: string,
  outputLines: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from('terminal_outputs')
    .upsert(
      {
        terminal_session_id: terminalSessionId,
        output_lines: outputLines,
        updated_at: new Date().toISOString(),
      } as never,
      {
        onConflict: 'terminal_session_id',
      }
    );

  if (error) {
    console.error('Error saving terminal output:', error);
    return false;
  }

  return true;
}

export async function appendTerminalOutput(
  supabase: SupabaseClient<Database>,
  terminalSessionId: string,
  newLines: string[],
  maxLines = 1000
): Promise<boolean> {
  // Get existing output
  const existing = await getTerminalOutput(supabase, terminalSessionId);
  const existingLines = existing?.output_lines || [];

  // Append new lines and trim if necessary
  let combinedLines = [...existingLines, ...newLines];
  if (combinedLines.length > maxLines) {
    combinedLines = combinedLines.slice(-maxLines);
  }

  return saveTerminalOutput(supabase, terminalSessionId, combinedLines);
}

export async function deleteTerminalOutput(
  supabase: SupabaseClient<Database>,
  terminalSessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('terminal_outputs')
    .delete()
    .eq('terminal_session_id', terminalSessionId);

  if (error) {
    console.error('Error deleting terminal output:', error);
    return false;
  }

  return true;
}
