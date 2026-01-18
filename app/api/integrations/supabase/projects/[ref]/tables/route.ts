import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ProjectCredentials {
  name: string;
  url: string;
  serviceKey: string;
}

async function getProjectCredentials(request: NextRequest, ref: string): Promise<{ url: string; key: string } | null> {
  // First try PAT + Management API
  const token = request.cookies.get('supabase_token')?.value;
  if (token) {
    // Get project API URL from management API
    try {
      const projectRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (projectRes.ok) {
        const keys = await projectRes.json();
        const serviceKey = keys.find((k: any) => k.name === 'service_role')?.api_key;
        if (serviceKey) {
          return {
            url: `https://${ref}.supabase.co`,
            key: serviceKey,
          };
        }
      }
    } catch (e) {
      console.error('Failed to get API keys from PAT:', e);
    }
  }

  // Try project credentials
  const projectsCookie = request.cookies.get('supabase_projects')?.value;
  if (projectsCookie) {
    try {
      const projects: ProjectCredentials[] = JSON.parse(projectsCookie);
      const project = projects.find(p => {
        const projectRef = new URL(p.url).hostname.split('.')[0];
        return projectRef === ref;
      });

      if (project) {
        return {
          url: project.url,
          key: project.serviceKey,
        };
      }
    } catch (e) {
      console.error('Failed to parse project credentials:', e);
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const credentials = await getProjectCredentials(request, ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Project not found or not authenticated' }, { status: 401 });
  }

  try {
    // Query the database schema to get tables
    const response = await fetch(
      `${credentials.url}/rest/v1/?apikey=${credentials.key}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.key}`,
        },
      }
    );

    if (!response.ok) {
      // Try alternative approach using pg_catalog
      const schemaRes = await fetch(
        `${credentials.url}/rest/v1/rpc/get_tables`,
        {
          method: 'POST',
          headers: {
            'apikey': credentials.key,
            'Authorization': `Bearer ${credentials.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!schemaRes.ok) {
        // Fallback: Try to get swagger spec which lists endpoints
        const swaggerRes = await fetch(`${credentials.url}/rest/v1/`, {
          headers: {
            'apikey': credentials.key,
            'Authorization': `Bearer ${credentials.key}`,
            'Accept': 'application/openapi+json',
          },
        });

        if (swaggerRes.ok) {
          const swagger = await swaggerRes.json();
          const tables = Object.keys(swagger.definitions || {})
            .filter(name => !name.startsWith('_'))
            .map(name => ({
              name,
              schema: 'public',
            }));

          return NextResponse.json({ tables });
        }

        return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
      }

      const tables = await schemaRes.json();
      return NextResponse.json({ tables });
    }

    // Parse response to extract table names
    const swagger = await response.json();
    const tables = Object.keys(swagger.definitions || {})
      .filter(name => !name.startsWith('_'))
      .map(name => ({
        name,
        schema: 'public',
      }));

    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Supabase tables fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}
