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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string; table: string }> }
) {
  const { ref, table } = await params;

  const credentials = await getProjectCredentials(request, ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Project not found or not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  const select = searchParams.get('select') || '*';

  try {
    // Fetch table data
    const response = await fetch(
      `${credentials.url}/rest/v1/${table}?select=${select}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'apikey': credentials.key,
          'Authorization': `Bearer ${credentials.key}`,
          'Prefer': 'count=exact',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch table data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const totalCount = response.headers.get('content-range')?.split('/')[1];

    // Get schema information
    let columns: { name: string; type: string }[] = [];
    if (data.length > 0) {
      // Infer columns from first row
      columns = Object.keys(data[0]).map(key => ({
        name: key,
        type: typeof data[0][key],
      }));
    }

    return NextResponse.json({
      table: {
        name: table,
        columns,
        rowCount: totalCount ? parseInt(totalCount) : data.length,
      },
      rows: data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalCount ? parseInt(totalCount) : data.length,
      },
    });
  } catch (error) {
    console.error('Supabase table data fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 });
  }
}
