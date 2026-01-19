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

// POST - Insert new row(s)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string; table: string }> }
) {
  const { ref, table } = await params;

  const credentials = await getProjectCredentials(ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const response = await fetch(
      `${credentials.url}/rest/v1/${table}`,
      {
        method: 'POST',
        headers: {
          'apikey': credentials.key,
          'Authorization': `Bearer ${credentials.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to insert row' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ success: true, rows: data });
  } catch (error) {
    console.error('Supabase insert error:', error);
    return NextResponse.json({ error: 'Failed to insert row' }, { status: 500 });
  }
}

// PATCH - Update row(s)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string; table: string }> }
) {
  const { ref, table } = await params;

  const credentials = await getProjectCredentials(ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  try {
    const { data, filter } = await request.json();

    if (!filter || Object.keys(filter).length === 0) {
      return NextResponse.json({ error: 'Filter is required for update' }, { status: 400 });
    }

    // Build filter query
    const filterParams = Object.entries(filter)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join('&');

    const response = await fetch(
      `${credentials.url}/rest/v1/${table}?${filterParams}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': credentials.key,
          'Authorization': `Bearer ${credentials.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to update row' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({ success: true, rows: result });
  } catch (error) {
    console.error('Supabase update error:', error);
    return NextResponse.json({ error: 'Failed to update row' }, { status: 500 });
  }
}

// DELETE - Delete row(s)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string; table: string }> }
) {
  const { ref, table } = await params;

  const credentials = await getProjectCredentials(ref);
  if (!credentials) {
    return NextResponse.json({ error: 'Supabase not connected. Please connect your Supabase account in integrations.' }, { status: 401 });
  }

  try {
    const { filter } = await request.json();

    if (!filter || Object.keys(filter).length === 0) {
      return NextResponse.json({ error: 'Filter is required for delete' }, { status: 400 });
    }

    // Build filter query
    const filterParams = Object.entries(filter)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join('&');

    const response = await fetch(
      `${credentials.url}/rest/v1/${table}?${filterParams}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': credentials.key,
          'Authorization': `Bearer ${credentials.key}`,
          'Prefer': 'return=representation',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to delete row' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error('Supabase delete error:', error);
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 });
  }
}
