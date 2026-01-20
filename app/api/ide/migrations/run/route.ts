import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';
import { getIntegrationToken } from '@/lib/integrations/tokens';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple hash for SQL content tracking
function hashSql(sql: string): string {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

// Helper to extract results from Supabase API response
function extractResults(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.result)) return obj.result;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

// Parse SQL error message to extract useful information
function parseSqlError(errorData: Record<string, unknown>): {
  message: string;
  code: string | null;
  hint: string | null;
  detail: string | null;
} {
  const message = String(errorData.message || errorData.error || 'Unknown SQL error');

  // Extract PostgreSQL error code (e.g., "42710" from "ERROR: 42710:")
  const codeMatch = message.match(/ERROR:\s*(\d+):/);
  const code = codeMatch ? codeMatch[1] : null;

  return {
    message: message
      .replace(/^ERROR:\s*\d+:\s*/, '') // Remove "ERROR: 42710:" prefix
      .replace(/^ERROR:\s*/, ''), // Remove "ERROR:" prefix
    code,
    hint: errorData.hint ? String(errorData.hint) : null,
    detail: errorData.detail ? String(errorData.detail) : null,
  };
}

// Record migration run in IDE history table
async function recordMigrationHistory(
  supabaseToken: string,
  projectRef: string,
  params: {
    migrationVersion: string;
    migrationName: string;
    migrationPath: string;
    owner: string;
    repo: string;
    success: boolean;
    errorMessage?: string;
    errorCode?: string;
    executionTimeMs?: number;
    sqlHash?: string;
  }
): Promise<void> {
  try {
    const query = `
      INSERT INTO public.ide_migration_history (
        migration_version,
        migration_name,
        migration_path,
        project_ref,
        owner,
        repo,
        success,
        error_message,
        error_code,
        execution_time_ms,
        sql_hash
      ) VALUES (
        '${params.migrationVersion}',
        '${params.migrationName.replace(/'/g, "''")}',
        '${params.migrationPath.replace(/'/g, "''")}',
        '${projectRef}',
        '${params.owner}',
        '${params.repo}',
        ${params.success},
        ${params.errorMessage ? `'${params.errorMessage.replace(/'/g, "''").slice(0, 1000)}'` : 'NULL'},
        ${params.errorCode ? `'${params.errorCode}'` : 'NULL'},
        ${params.executionTimeMs ?? 'NULL'},
        ${params.sqlHash ? `'${params.sqlHash}'` : 'NULL'}
      )
      ON CONFLICT (project_ref, migration_version) DO UPDATE SET
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message,
        error_code = EXCLUDED.error_code,
        execution_time_ms = EXCLUDED.execution_time_ms,
        executed_at = now()
    `;

    await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    // Don't fail the migration if history recording fails
    console.error('Failed to record migration history:', err);
  }
}

export async function POST(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { owner, repo, projectRef, migrationPath, migrationVersion } = body;

  if (!owner || !repo || !projectRef || !migrationPath || !migrationVersion) {
    return NextResponse.json(
      { error: 'Owner, repo, projectRef, migrationPath, and migrationVersion are required' },
      { status: 400 }
    );
  }

  const supabaseToken = await getIntegrationToken('supabase_pat');

  if (!supabaseToken) {
    return NextResponse.json({ error: 'Supabase not connected' }, { status: 401 });
  }

  try {
    // 1. Check if migration is already applied
    const checkQuery = `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${migrationVersion}'`;
    const checkResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: checkQuery }),
      }
    );

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const results = extractResults(checkData);
      if (results.length > 0) {
        return NextResponse.json({
          success: false,
          alreadyApplied: true,
          error: 'Migration already applied',
          message: `Migration ${migrationVersion} has already been applied to this database.`,
        });
      }
    }

    // 2. Fetch the migration file content from GitHub
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${migrationPath}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!githubResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch migration file from GitHub' },
        { status: githubResponse.status }
      );
    }

    const fileData = await githubResponse.json();
    const migrationContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const migrationName = migrationPath.split('/').pop() || '';
    const sqlHash = hashSql(migrationContent);

    // 3. Run the migration SQL (track execution time)
    const startTime = Date.now();
    const sqlResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: migrationContent }),
      }
    );
    const executionTimeMs = Date.now() - startTime;

    if (!sqlResponse.ok) {
      const errorData = await sqlResponse.json().catch(() => ({}));
      const parsed = parseSqlError(errorData);

      // Check if this is an "already exists" error
      const isAlreadyExistsError =
        parsed.code === '42710' || // duplicate_object
        parsed.code === '42P07' || // duplicate_table
        parsed.message.toLowerCase().includes('already exists');

      // Record failed migration in history
      await recordMigrationHistory(supabaseToken, projectRef, {
        migrationVersion,
        migrationName,
        migrationPath,
        owner,
        repo,
        success: false,
        errorMessage: parsed.message,
        errorCode: parsed.code ?? undefined,
        executionTimeMs,
        sqlHash,
      });

      return NextResponse.json({
        success: false,
        alreadyApplied: isAlreadyExistsError,
        error: parsed.message,
        errorCode: parsed.code,
        hint: parsed.hint,
        detail: parsed.detail,
        message: isAlreadyExistsError
          ? 'This migration appears to have already been applied (objects already exist in database).'
          : `SQL Error: ${parsed.message}`,
      });
    }

    // 4. Record the migration in schema_migrations table
    const recordQuery = `
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ('${migrationVersion}', ARRAY[]::text[], '${migrationName.replace(/'/g, "''")}')
      ON CONFLICT (version) DO NOTHING
    `;

    const recordResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: recordQuery }),
      }
    );

    const recorded = recordResponse.ok;

    // Record successful migration in IDE history
    await recordMigrationHistory(supabaseToken, projectRef, {
      migrationVersion,
      migrationName,
      migrationPath,
      owner,
      repo,
      success: true,
      executionTimeMs,
      sqlHash,
    });

    return NextResponse.json({
      success: true,
      recorded,
      message: `Migration ${migrationVersion} applied successfully`,
      version: migrationVersion,
      executionTimeMs,
    });
  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run migration',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    }, { status: 500 });
  }
}
