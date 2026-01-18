'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { WorkspaceSession } from '@/types/database';

interface UseWorkspaceSessionsOptions {
  repoFullName: string;
  enabled?: boolean;
}

interface UseWorkspaceSessionsReturn {
  sessions: WorkspaceSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSession: (sessionId: string, name: string, branchName: string) => Promise<WorkspaceSession | null>;
  updateSession: (sessionId: string, name: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
}

export function useWorkspaceSessions({
  repoFullName,
  enabled = true,
}: UseWorkspaceSessionsOptions): UseWorkspaceSessionsReturn {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const refresh = useCallback(async () => {
    if (!enabled || !repoFullName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('workspace_sessions')
        .select('*')
        .eq('repo_full_name', repoFullName)
        .order('last_accessed_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setSessions((data as WorkspaceSession[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      console.error('Error fetching workspace sessions:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, repoFullName, enabled]);

  const createSession = useCallback(
    async (
      sessionId: string,
      name: string,
      branchName: string
    ): Promise<WorkspaceSession | null> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('Not authenticated');
        }

        const { data, error: insertError } = await supabase
          .from('workspace_sessions')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            repo_full_name: repoFullName,
            name,
            branch_name: branchName,
            base_branch: 'main',
          } as never)
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        const newSession = data as WorkspaceSession;
        setSessions((prev) => [newSession, ...prev]);
        return newSession;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        console.error('Error creating workspace session:', err);
        setError(message);
        return null;
      }
    },
    [supabase, repoFullName]
  );

  const updateSession = useCallback(
    async (sessionId: string, name: string): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('workspace_sessions')
          .update({ name, last_accessed_at: new Date().toISOString() } as never)
          .eq('session_id', sessionId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setSessions((prev) =>
          prev.map((s) => (s.session_id === sessionId ? { ...s, name } : s))
        );
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update session';
        console.error('Error updating workspace session:', err);
        setError(message);
        return false;
      }
    },
    [supabase]
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('workspace_sessions')
          .delete()
          .eq('session_id', sessionId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete session';
        console.error('Error deleting workspace session:', err);
        setError(message);
        return false;
      }
    },
    [supabase]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    sessions,
    loading,
    error,
    refresh,
    createSession,
    updateSession,
    deleteSession,
  };
}

// Hook for a single workspace session
export function useWorkspaceSession(sessionId: string | null) {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    async function fetchSession() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('workspace_sessions')
          .select('*')
          .eq('session_id', sessionId!)
          .single();

        if (fetchError) {
          if (fetchError.code !== 'PGRST116') {
            throw new Error(fetchError.message);
          }
          setSession(null);
          return;
        }

        setSession(data as WorkspaceSession);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load session';
        console.error('Error fetching workspace session:', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [supabase, sessionId]);

  return { session, loading, error };
}
