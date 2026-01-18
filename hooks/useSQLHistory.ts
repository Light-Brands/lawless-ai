'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { SqlQueryHistory } from '@/types/database';

interface UseSQLHistoryOptions {
  projectRef: string;
  limit?: number;
  enabled?: boolean;
}

interface UseSQLHistoryReturn {
  history: SqlQueryHistory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addQuery: (query: string, success: boolean, rowCount?: number, executionTimeMs?: number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useSQLHistory({
  projectRef,
  limit = 100,
  enabled = true,
}: UseSQLHistoryOptions): UseSQLHistoryReturn {
  const [history, setHistory] = useState<SqlQueryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const refresh = useCallback(async () => {
    if (!enabled || !projectRef) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sql_query_history')
        .select('*')
        .eq('project_ref', projectRef)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setHistory((data as SqlQueryHistory[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load SQL history';
      console.error('Error fetching SQL history:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, projectRef, limit, enabled]);

  const addQuery = useCallback(
    async (
      query: string,
      success: boolean,
      rowCount?: number,
      executionTimeMs?: number
    ) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // Not authenticated - can't persist
          return;
        }

        const { data, error: insertError } = await supabase
          .from('sql_query_history')
          .insert({
            user_id: user.id,
            project_ref: projectRef,
            query,
            success,
            row_count: rowCount,
            execution_time_ms: executionTimeMs,
          } as never)
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (data) {
          setHistory((prev) => [data as SqlQueryHistory, ...prev].slice(0, limit));
        }
      } catch (err: unknown) {
        console.error('Error saving SQL query:', err);
        // Don't set error state - this is a background save
      }
    },
    [supabase, projectRef, limit]
  );

  const clearHistory = useCallback(async () => {
    try {
      const { error: deleteError } = await supabase
        .from('sql_query_history')
        .delete()
        .eq('project_ref', projectRef);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setHistory([]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear history';
      console.error('Error clearing SQL history:', err);
      setError(message);
    }
  }, [supabase, projectRef]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    history,
    loading,
    error,
    refresh,
    addQuery,
    clearHistory,
  };
}

// Hook for recent/unique queries (for autocomplete)
export function useRecentQueries(projectRef: string, limit = 20) {
  const [queries, setQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!projectRef) {
      setQueries([]);
      setLoading(false);
      return;
    }

    async function fetchQueries() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('sql_query_history')
          .select('query')
          .eq('project_ref', projectRef)
          .eq('success', true)
          .order('created_at', { ascending: false })
          .limit(limit * 2); // Fetch more to account for duplicates

        if (error) {
          throw error;
        }

        // Deduplicate queries
        type QueryRow = { query: string };
        const uniqueQueries = [...new Set((data as QueryRow[] | null)?.map((d) => d.query) || [])].slice(
          0,
          limit
        );
        setQueries(uniqueQueries);
      } catch (err) {
        console.error('Error fetching recent queries:', err);
        setQueries([]);
      } finally {
        setLoading(false);
      }
    }

    fetchQueries();
  }, [supabase, projectRef, limit]);

  return { queries, loading };
}
