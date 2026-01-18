'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { TerminalSession, TerminalOutput } from '@/types/database';

interface UseTerminalSessionsOptions {
  repoFullName: string;
  enabled?: boolean;
}

interface UseTerminalSessionsReturn {
  sessions: TerminalSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSession: (sessionId: string, name: string, branchName?: string) => Promise<TerminalSession | null>;
  updateSession: (sessionId: string, name: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
}

export function useTerminalSessions({
  repoFullName,
  enabled = true,
}: UseTerminalSessionsOptions): UseTerminalSessionsReturn {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
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
        .from('terminal_sessions')
        .select('*')
        .eq('repo_full_name', repoFullName)
        .order('last_accessed_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setSessions((data as TerminalSession[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      console.error('Error fetching terminal sessions:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, repoFullName, enabled]);

  const createSession = useCallback(
    async (
      sessionId: string,
      name: string,
      branchName?: string
    ): Promise<TerminalSession | null> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('Not authenticated');
        }

        const { data, error: insertError } = await supabase
          .from('terminal_sessions')
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

        const newSession = data as TerminalSession;
        setSessions((prev) => [newSession, ...prev]);
        return newSession;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        console.error('Error creating terminal session:', err);
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
          .from('terminal_sessions')
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
        console.error('Error updating terminal session:', err);
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
          .from('terminal_sessions')
          .delete()
          .eq('session_id', sessionId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete session';
        console.error('Error deleting terminal session:', err);
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

// Hook for terminal output with auto-sync
interface UseTerminalOutputOptions {
  terminalSessionId: string | null;
  maxLines?: number;
  syncInterval?: number; // ms, 0 to disable auto-sync
}

export function useTerminalOutput({
  terminalSessionId,
  maxLines = 1000,
  syncInterval = 5000,
}: UseTerminalOutputOptions) {
  const [output, setOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localBuffer = useRef<string[]>([]);
  const isDirty = useRef(false);

  const supabase = getSupabaseClient();

  // Load initial output
  useEffect(() => {
    if (!terminalSessionId) {
      setOutput([]);
      setLoading(false);
      return;
    }

    async function loadOutput() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('terminal_outputs')
          .select('output_lines')
          .eq('terminal_session_id', terminalSessionId!)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(fetchError.message);
        }

        const lines = (data as TerminalOutput | null)?.output_lines || [];
        setOutput(lines);
        localBuffer.current = [...lines];
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load output';
        console.error('Error loading terminal output:', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadOutput();
  }, [supabase, terminalSessionId]);

  // Append new lines to local buffer
  const appendLines = useCallback((newLines: string[]) => {
    localBuffer.current = [...localBuffer.current, ...newLines];
    if (localBuffer.current.length > maxLines) {
      localBuffer.current = localBuffer.current.slice(-maxLines);
    }
    setOutput([...localBuffer.current]);
    isDirty.current = true;
  }, [maxLines]);

  // Sync to database
  const sync = useCallback(async () => {
    if (!terminalSessionId || !isDirty.current) {
      return;
    }

    try {
      const { error: upsertError } = await supabase
        .from('terminal_outputs')
        .upsert(
          {
            terminal_session_id: terminalSessionId,
            output_lines: localBuffer.current,
            updated_at: new Date().toISOString(),
          } as never,
          {
            onConflict: 'terminal_session_id',
          }
        );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      isDirty.current = false;
    } catch (err: unknown) {
      console.error('Error syncing terminal output:', err);
    }
  }, [supabase, terminalSessionId]);

  // Auto-sync at interval
  useEffect(() => {
    if (!terminalSessionId || syncInterval <= 0) {
      return;
    }

    const interval = setInterval(sync, syncInterval);
    return () => {
      clearInterval(interval);
      // Sync on unmount
      sync();
    };
  }, [terminalSessionId, syncInterval, sync]);

  // Clear output
  const clear = useCallback(async () => {
    localBuffer.current = [];
    setOutput([]);
    isDirty.current = true;
    await sync();
  }, [sync]);

  return {
    output,
    loading,
    error,
    appendLines,
    sync,
    clear,
  };
}
