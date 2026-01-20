import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
  version: string;
  status: 'applied' | 'pending';
  appliedAt?: string;
}

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

// Parse migration filename to extract version and timestamp
// Format: 20240101120000_migration_name.sql
function parseMigrationName(filename: string): { version: string; timestamp: string; name: string } | null {
  const match = filename.match(/^(\d{14})_(.+)\.sql$/);
  if (!match) return null;

  const version = match[1];
  const name = match[2].replace(/_/g, ' ');

  // Parse timestamp from version: YYYYMMDDHHmmss
  const year = version.slice(0, 4);
  const month = version.slice(4, 6);
  const day = version.slice(6, 8);
  const hour = version.slice(8, 10);
  const minute = version.slice(10, 12);
  const second = version.slice(12, 14);

  const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;

  return { version, timestamp, name };
}

// Helper to extract results from Supabase API response (handles different formats)
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

export async function GET(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const projectRef = searchParams.get('projectRef');
  const ref = searchParams.get('ref'); // branch/commit ref

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo required' }, { status: 400 });
  }

  try {
    // 1. Fetch migration files from GitHub
    let url = `https://api.github.com/repos/${owner}/${repo}/contents/supabase/migrations`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const githubResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let migrationFiles: MigrationFile[] = [];

    if (githubResponse.ok) {
      const contents: GitHubContent[] = await githubResponse.json();

      // Filter for SQL files and parse their names
      migrationFiles = contents
        .filter((file) => file.type === 'file' && file.name.endsWith('.sql'))
        .map((file) => {
          const parsed = parseMigrationName(file.name);
          return {
            name: file.name,
            path: file.path,
            timestamp: parsed?.timestamp || '',
            version: parsed?.version || file.name,
            status: 'pending' as const, // Will be updated below if applied
          };
        })
        .sort((a, b) => a.version.localeCompare(b.version));
    } else if (githubResponse.status !== 404) {
      // 404 just means no migrations directory yet
      console.error('GitHub API error:', githubResponse.status);
    }

    // 2. If we have a Supabase project ref, check which migrations are applied
    if (projectRef) {
      const supabaseToken = await getIntegrationToken('supabase_pat');

      if (supabaseToken) {
        try {
          // Query the schema_migrations table
          const sqlQuery = `SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version`;

          const sqlResponse = await fetch(
            `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${supabaseToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: sqlQuery }),
            }
          );

          if (sqlResponse.ok) {
            const sqlData = await sqlResponse.json();
            const results = extractResults(sqlData);

            // Build a map of applied versions with their timestamps
            const appliedMap = new Map<string, string>();
            for (const row of results) {
              const version = String(row.version || '');
              const insertedAt = String(row.inserted_at || '');
              if (version) {
                appliedMap.set(version, insertedAt);
              }
            }

            // Update migration statuses
            migrationFiles = migrationFiles.map((file) => {
              const appliedAt = appliedMap.get(file.version);
              if (appliedAt) {
                return {
                  ...file,
                  status: 'applied' as const,
                  appliedAt,
                };
              }
              return file;
            });
          } else {
            const errorText = await sqlResponse.text();
            console.error('Failed to query schema_migrations:', sqlResponse.status, errorText);
          }
        } catch (err) {
          console.error('Failed to fetch applied migrations:', err);
          // Continue with pending status for all
        }
      }
    }

    // Calculate pending migrations
    const pendingMigrations = migrationFiles.filter((m) => m.status === 'pending');

    // Sort: pending migrations first (by version), then applied (by version)
    migrationFiles.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'applied') return -1;
      if (a.status === 'applied' && b.status === 'pending') return 1;
      return a.version.localeCompare(b.version);
    });

    return NextResponse.json({
      migrations: migrationFiles,
      summary: {
        total: migrationFiles.length,
        applied: migrationFiles.length - pendingMigrations.length,
        pending: pendingMigrations.length,
      },
    });
  } catch (error) {
    console.error('Error fetching migrations:', error);
    return NextResponse.json({ error: 'Failed to fetch migrations' }, { status: 500 });
  }
}
