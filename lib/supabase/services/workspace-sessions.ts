import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, WorkspaceSession } from '@/types/database';

export type WorkspaceSessionInput = {
  sessionId: string;
  repoFullName: string;
  name: string;
  branchName: string;
  baseBranch?: string;
  baseCommit?: string;
};

export async function createWorkspaceSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: WorkspaceSessionInput
): Promise<WorkspaceSession | null> {
  const { data, error } = await supabase
    .from('workspace_sessions')
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
    console.error('Error creating workspace session:', error);
    return null;
  }

  return data as WorkspaceSession;
}

export async function getWorkspaceSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<WorkspaceSession | null> {
  const { data, error } = await supabase
    .from('workspace_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      // Not a "not found" error
      console.error('Error fetching workspace session:', error);
    }
    return null;
  }

  return data as WorkspaceSession;
}

export async function listWorkspaceSessions(
  supabase: SupabaseClient<Database>,
  repoFullName: string
): Promise<WorkspaceSession[]> {
  const { data, error } = await supabase
    .from('workspace_sessions')
    .select('*')
    .eq('repo_full_name', repoFullName)
    .order('last_accessed_at', { ascending: false });

  if (error) {
    console.error('Error listing workspace sessions:', error);
    return [];
  }

  return (data as WorkspaceSession[]) || [];
}

export async function updateWorkspaceSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  updates: Partial<{
    name: string;
    last_accessed_at: string;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('workspace_sessions')
    .update({
      ...updates,
      last_accessed_at: updates.last_accessed_at || new Date().toISOString(),
    } as never)
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error updating workspace session:', error);
    return false;
  }

  return true;
}

export async function deleteWorkspaceSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('workspace_sessions')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error deleting workspace session:', error);
    return false;
  }

  return true;
}

export async function touchWorkspaceSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<void> {
  await supabase
    .from('workspace_sessions')
    .update({ last_accessed_at: new Date().toISOString() } as never)
    .eq('session_id', sessionId);
}
