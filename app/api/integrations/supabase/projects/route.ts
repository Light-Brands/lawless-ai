import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

export async function GET() {
  const token = await getIntegrationToken('supabase_pat');

  if (!token) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: response.status });
    }

    const data = await response.json();

    const projects = data.map((project: any) => ({
      id: project.id,
      ref: project.ref,
      name: project.name,
      organizationId: project.organization_id,
      region: project.region,
      createdAt: project.created_at,
      status: project.status,
      databaseHost: project.database?.host,
    }));

    return NextResponse.json({ projects, source: 'pat' });
  } catch (error) {
    console.error('Supabase projects fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// Create a new Supabase project
export async function POST(request: NextRequest) {
  const token = await getIntegrationToken('supabase_pat');

  if (!token) {
    return NextResponse.json(
      { error: 'Supabase not connected. Please connect your Supabase account in integrations.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, organization_id, region, db_pass } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // If no organization_id provided, fetch the first one
    let orgId = organization_id;
    if (!orgId) {
      const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (orgsResponse.ok) {
        const orgs = await orgsResponse.json();
        if (orgs.length > 0) {
          orgId = orgs[0].id;
        }
      }

      if (!orgId) {
        return NextResponse.json({ error: 'No organization found. Please create one in Supabase dashboard first.' }, { status: 400 });
      }
    }

    // Generate a secure password if not provided
    const dbPassword = db_pass || generateSecurePassword();

    // Create the project
    const createResponse = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        organization_id: orgId,
        region: region || 'us-east-1',
        db_pass: dbPassword,
        plan: 'free',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return NextResponse.json(
        { error: error.message || 'Failed to create project' },
        { status: createResponse.status }
      );
    }

    const project = await createResponse.json();

    // Return project info (note: API keys take a moment to generate)
    return NextResponse.json({
      project: {
        id: project.id,
        ref: project.ref,
        name: project.name,
        region: project.region,
        status: project.status,
        organizationId: project.organization_id,
        // Database password - store this securely!
        dbPassword,
      },
      message: 'Project created. API keys will be available in ~30 seconds.',
    });
  } catch (error) {
    console.error('Supabase project creation error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

// Generate a secure random password
function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
