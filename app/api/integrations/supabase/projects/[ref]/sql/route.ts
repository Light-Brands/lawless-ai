import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ProjectCredentials {
  name: string;
  url: string;
  serviceKey: string;
}

async function getProjectCredentials(request: NextRequest, ref: string): Promise<{ url: string; key: string } | null> {
  const token = request.cookies.get('supabase_token')?.value;
  if (token) {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const credentials = await getProjectCredentials(request, ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Project not found or not authenticated' }, { status: 401 });
  }

  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use PostgREST RPC to execute SQL
    // Note: This requires a custom function to be set up in Supabase
    // For basic queries, we'll use the /rest/v1/rpc endpoint
    const response = await fetch(
      `${credentials.url}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'apikey': credentials.key,
          'Authorization': `Bearer ${credentials.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      // The exec_sql function might not exist, try alternative approach
      // For SELECT queries, we can parse and convert to PostgREST syntax
      const errorData = await response.json().catch(() => ({}));

      // If it's a simple SELECT, try to convert to PostgREST
      if (query.trim().toLowerCase().startsWith('select')) {
        return NextResponse.json({
          error: 'Direct SQL execution requires the exec_sql function. Please use the table browser for queries.',
          hint: 'Create a function called exec_sql in your Supabase project to enable custom SQL queries.',
        }, { status: 400 });
      }

      return NextResponse.json(
        { error: errorData.message || 'Failed to execute query' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      results: data,
      rowCount: Array.isArray(data) ? data.length : 0,
    });
  } catch (error) {
    console.error('Supabase SQL execution error:', error);
    return NextResponse.json({ error: 'Failed to execute query' }, { status: 500 });
  }
}
