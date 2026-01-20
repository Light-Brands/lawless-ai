import { getSupabaseClient } from '../lib/supabase';

export interface WorkspaceSessionRow {
  id: string;
  user_id: string;
  session_id: string;
  repo_full_name: string;
  name: string;
  branch_name: string;
  base_branch: string;
  base_commit: string | null;
  created_at: string;
  last_accessed_at: string;
}

export interface WorkspaceSessionInput {
  sessionId: string;
  userId: string;
  repoFullName: string;
  name: string;
  branchName: string;
  baseBranch?: string;
  baseCommit?: string;
  worktreePath?: string;
}

/**
 * Create a workspace session in Supabase
 */
export async function createSupabaseWorkspaceSession(
  input: WorkspaceSessionInput
): Promise<WorkspaceSessionRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('[WorkspaceSessionService] Supabase not available, skipping cloud persistence');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('workspace_sessions')
      .insert({
        user_id: input.userId,
        session_id: input.sessionId,
        repo_full_name: input.repoFullName,
        name: input.name,
        branch_name: input.branchName,
        base_branch: input.baseBranch || 'main',
        base_commit: input.baseCommit || null,
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate key error (session already exists)
      if (error.code === '23505') {
        console.log(`[WorkspaceSessionService] Session ${input.sessionId} already exists in Supabase`);
        return getSupabaseWorkspaceSession(input.sessionId);
      }
      console.error('[WorkspaceSessionService] Error creating session:', error);
      return null;
    }

    console.log(`[WorkspaceSessionService] Created session ${input.sessionId} in Supabase`);
    return data as WorkspaceSessionRow;
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception creating session:', error);
    return null;
  }
}

/**
 * Get a workspace session from Supabase by session_id
 */
export async function getSupabaseWorkspaceSession(
  sessionId: string
): Promise<WorkspaceSessionRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('workspace_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        // Not a "not found" error
        console.error('[WorkspaceSessionService] Error fetching session:', error);
      }
      return null;
    }

    return data as WorkspaceSessionRow;
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception fetching session:', error);
    return null;
  }
}

/**
 * List all workspace sessions for a repo from Supabase
 */
export async function listSupabaseWorkspaceSessions(
  repoFullName: string,
  userId?: string
): Promise<WorkspaceSessionRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('[WorkspaceSessionService] Supabase not available');
    return [];
  }

  try {
    // Normalize inputs
    const normalizedRepo = repoFullName.trim();
    const normalizedUserId = userId?.trim();

    console.log(`[WorkspaceSessionService] Listing sessions for repo="${normalizedRepo}" user="${normalizedUserId}"`);

    let query = supabase
      .from('workspace_sessions')
      .select('*')
      .eq('repo_full_name', normalizedRepo)
      .order('last_accessed_at', { ascending: false });

    // If userId is provided, filter by user
    if (normalizedUserId) {
      query = query.eq('user_id', normalizedUserId);
    }

    const { data, error } = await query;

    console.log(`[WorkspaceSessionService] Query returned ${data?.length || 0} sessions, error: ${error?.message || 'none'}`);

    // Log session details for debugging
    if (data && data.length > 0) {
      data.forEach((s: any) => {
        console.log(`[WorkspaceSessionService]   - ${s.session_id}: repo="${s.repo_full_name}" user="${s.user_id}" name="${s.name}"`);
      });
    }

    if (error) {
      console.error('[WorkspaceSessionService] Error listing sessions:', error);
      return [];
    }

    return (data as WorkspaceSessionRow[]) || [];
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception listing sessions:', error);
    return [];
  }
}

/**
 * Update a workspace session in Supabase
 */
export async function updateSupabaseWorkspaceSession(
  sessionId: string,
  updates: Partial<{
    name: string;
    last_accessed_at: string;
  }>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('workspace_sessions')
      .update({
        ...updates,
        last_accessed_at: updates.last_accessed_at || new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[WorkspaceSessionService] Error updating session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception updating session:', error);
    return false;
  }
}

/**
 * Delete a workspace session from Supabase
 */
export async function deleteSupabaseWorkspaceSession(
  sessionId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('workspace_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('[WorkspaceSessionService] Error deleting session:', error);
      return false;
    }

    console.log(`[WorkspaceSessionService] Deleted session ${sessionId} from Supabase`);
    return true;
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception deleting session:', error);
    return false;
  }
}

/**
 * Touch a workspace session (update last_accessed_at)
 */
export async function touchSupabaseWorkspaceSession(
  sessionId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  try {
    await supabase
      .from('workspace_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('session_id', sessionId);
  } catch (error) {
    console.error('[WorkspaceSessionService] Error touching session:', error);
  }
}

/**
 * Get message count for a workspace session from Supabase
 */
export async function getSupabaseSessionMessageCount(
  sessionId: string
): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 0;
  }

  try {
    // Get the workspace session's UUID first
    const { data: session } = await supabase
      .from('workspace_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (!session) {
      return 0;
    }

    // Count conversations linked to this session
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_session_id', session.id);

    if (error) {
      console.error('[WorkspaceSessionService] Error counting messages:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[WorkspaceSessionService] Exception counting messages:', error);
    return 0;
  }
}
