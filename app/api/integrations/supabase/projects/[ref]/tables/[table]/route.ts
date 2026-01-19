import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

async function getProjectCredentials(ref: string): Promise<{ url: string; key: string } | null> {
  const token = await getIntegrationToken('supabase_pat');
  if (!token) {
    return null;
  }

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

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string; table: string }> }
) {
  const { ref, table } = await params;

  const credentials = await getProjectCredentials(ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
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
