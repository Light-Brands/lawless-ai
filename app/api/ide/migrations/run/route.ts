import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    // 1. Fetch the migration file content from GitHub
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

    // 2. Get the Supabase token
    const supabaseToken = await getIntegrationToken('supabase_pat');

    if (!supabaseToken) {
      return NextResponse.json({ error: 'Supabase not connected' }, { status: 401 });
    }

    // 3. Run the migration SQL
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

    if (!sqlResponse.ok) {
      const errorData = await sqlResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to run migration SQL', details: errorData },
        { status: sqlResponse.status }
      );
    }

    // 4. Record the migration in schema_migrations table
    const recordQuery = `
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ('${migrationVersion}', ARRAY[]::text[], '${migrationPath.split('/').pop()}')
      ON CONFLICT (version) DO NOTHING
    `;

    await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: recordQuery }),
    });

    return NextResponse.json({
      success: true,
      message: `Migration ${migrationVersion} applied successfully`,
    });
  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json({ error: 'Failed to run migration' }, { status: 500 });
  }
}
