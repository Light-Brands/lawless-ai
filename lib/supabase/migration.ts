'use client';

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TerminalSession } from '@/types/database';

const MIGRATION_KEY = 'supabase_migration_completed';
const MIGRATION_VERSION = 'v1';

export interface MigrationResult {
  success: boolean;
  error?: string;
  migrated: {
    terminalSessions: number;
    terminalOutputs: number;
    sqlQueries: number;
  };
}

/**
 * Check if migration has already been completed
 */
export function isMigrationCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  const completed = localStorage.getItem(MIGRATION_KEY);
  return completed === MIGRATION_VERSION;
}

/**
 * Mark migration as completed
 */
export function markMigrationCompleted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
}

interface LocalTerminalSession {
  id: string;
  name: string;
  createdAt: string;
  branchName?: string;
  baseBranch?: string;
  baseCommit?: string;
}

interface LocalSQLQuery {
  query: string;
  success: boolean;
  rowCount?: number;
  executionTimeMs?: number;
  timestamp?: string;
}

/**
 * Get all terminal sessions from localStorage
 */
function getLocalTerminalSessions(): Array<{
  repoPath: string;
  sessions: LocalTerminalSession[];
}> {
  if (typeof window === 'undefined') return [];

  const results: Array<{ repoPath: string; sessions: LocalTerminalSession[] }> = [];

  // Find all terminal session keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('terminal_sessions_')) {
      try {
        const repoPath = key.replace('terminal_sessions_', '').replace('_', '/');
        const sessions = JSON.parse(localStorage.getItem(key) || '[]') as LocalTerminalSession[];
        results.push({ repoPath, sessions });
      } catch (e) {
        console.error('Error parsing terminal sessions:', key, e);
      }
    }
  }

  return results;
}

/**
 * Get all terminal outputs from localStorage
 */
function getLocalTerminalOutputs(): Map<string, string[]> {
  if (typeof window === 'undefined') return new Map();

  const outputs = new Map<string, string[]>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('terminal_outputs_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string[]>;
        // data is { sessionId: string[] }
        Object.entries(data).forEach(([sessionId, lines]) => {
          outputs.set(sessionId, lines);
        });
      } catch (e) {
        console.error('Error parsing terminal outputs:', key, e);
      }
    }
  }

  return outputs;
}

/**
 * Get SQL query history from localStorage
 */
function getLocalSQLHistory(): Array<{
  projectRef: string;
  queries: LocalSQLQuery[];
}> {
  if (typeof window === 'undefined') return [];

  const results: Array<{ projectRef: string; queries: LocalSQLQuery[] }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('sql_history_')) {
      try {
        const projectRef = key.replace('sql_history_', '');
        const queries = JSON.parse(localStorage.getItem(key) || '[]') as LocalSQLQuery[];
        results.push({ projectRef, queries });
      } catch (e) {
        console.error('Error parsing SQL history:', key, e);
      }
    }
  }

  return results;
}

/**
 * Migrate all localStorage data to Supabase
 */
export async function migrateLocalStorageToSupabase(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migrated: {
      terminalSessions: 0,
      terminalOutputs: 0,
      sqlQueries: 0,
    },
  };

  try {
    // Check if already migrated
    if (isMigrationCompleted()) {
      console.log('Migration already completed, skipping...');
      return result;
    }

    console.log('Starting localStorage migration to Supabase...');

    // Migrate terminal sessions
    const terminalSessions = getLocalTerminalSessions();
    for (const { repoPath, sessions } of terminalSessions) {
      for (const session of sessions) {
        try {
          const { error } = await supabase.from('terminal_sessions').upsert(
            {
              user_id: userId,
              session_id: session.id,
              repo_full_name: repoPath,
              name: session.name,
              branch_name: session.branchName,
              base_branch: session.baseBranch || 'main',
              base_commit: session.baseCommit,
              created_at: session.createdAt,
            } as never,
            {
              onConflict: 'user_id,session_id',
              ignoreDuplicates: true,
            }
          );

          if (!error) {
            result.migrated.terminalSessions++;
          }
        } catch (e) {
          console.error('Error migrating terminal session:', session.id, e);
        }
      }
    }

    // Migrate terminal outputs
    const terminalOutputs = getLocalTerminalOutputs();
    for (const [sessionId, lines] of terminalOutputs) {
      try {
        // First get the terminal session to get its ID
        const { data: session } = await supabase
          .from('terminal_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .single();

        const sessionTyped = session as TerminalSession | null;
        if (sessionTyped) {
          const { error } = await supabase.from('terminal_outputs').upsert(
            {
              terminal_session_id: sessionTyped.id,
              output_lines: lines,
            } as never,
            {
              onConflict: 'terminal_session_id',
            }
          );

          if (!error) {
            result.migrated.terminalOutputs++;
          }
        }
      } catch (e) {
        console.error('Error migrating terminal output:', sessionId, e);
      }
    }

    // Migrate SQL query history
    const sqlHistory = getLocalSQLHistory();
    for (const { projectRef, queries } of sqlHistory) {
      for (const query of queries) {
        try {
          const { error } = await supabase.from('sql_query_history').insert({
            user_id: userId,
            project_ref: projectRef,
            query: query.query,
            success: query.success,
            row_count: query.rowCount,
            execution_time_ms: query.executionTimeMs,
            created_at: query.timestamp || new Date().toISOString(),
          } as never);

          if (!error) {
            result.migrated.sqlQueries++;
          }
        } catch (e) {
          // Ignore duplicate errors for queries
        }
      }
    }

    // Mark migration as completed
    markMigrationCompleted();

    console.log('Migration completed:', result.migrated);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration failed';
    console.error('Migration failed:', error);
    result.success = false;
    result.error = message;
    return result;
  }
}

/**
 * Clean up localStorage after successful migration
 * Call this only after confirming data is in Supabase
 */
export function cleanupLocalStorage(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key?.startsWith('terminal_sessions_') ||
      key?.startsWith('terminal_outputs_') ||
      key?.startsWith('sql_history_')
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log('Cleaned up', keysToRemove.length, 'localStorage keys');
}

/**
 * React hook to handle migration on first auth
 */
export function useMigration(supabase: SupabaseClient<Database>, userId: string | null) {
  if (typeof window === 'undefined') return;
  if (!userId) return;
  if (isMigrationCompleted()) return;

  // Run migration in background
  migrateLocalStorageToSupabase(supabase, userId).then((migrationResult) => {
    if (migrationResult.success) {
      console.log('Migration successful:', migrationResult.migrated);
    } else {
      console.error('Migration failed:', migrationResult.error);
    }
  });
}
