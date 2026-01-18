import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const token = request.cookies.get('supabase_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with PAT' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startingAfter = searchParams.get('startingAfter');

  try {
    // Fetch logs from Management API
    let url = `https://api.supabase.com/v1/projects/${ref}/database/logs`;
    if (startingAfter) {
      url += `?starting_after=${startingAfter}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch logs' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      logs: data.data || [],
      hasMore: data.has_more || false,
    });
  } catch (error) {
    console.error('Supabase logs fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
