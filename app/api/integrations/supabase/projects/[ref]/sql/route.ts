import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const token = request.cookies.get('supabase_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Supabase' }, { status: 401 });
  }

  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use Supabase Management API to execute SQL
    // This endpoint allows direct SQL execution with the PAT token
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle specific error cases
      if (response.status === 400) {
        return NextResponse.json({
          error: errorData.message || 'Invalid SQL query',
          hint: errorData.hint,
        }, { status: 400 });
      }

      if (response.status === 403) {
        return NextResponse.json({
          error: 'Permission denied. Your access token may not have database access.',
          hint: 'Make sure your Supabase access token has the necessary permissions.',
        }, { status: 403 });
      }

      return NextResponse.json(
        {
          error: errorData.message || 'Failed to execute query',
          hint: errorData.hint,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // The Management API returns results in a specific format
    // Handle both array results and single object results
    let results = [];
    if (Array.isArray(data)) {
      results = data;
    } else if (data.result) {
      results = Array.isArray(data.result) ? data.result : [data.result];
    } else if (data.rows) {
      results = data.rows;
    } else if (typeof data === 'object' && data !== null) {
      // If it's an object with data, try to extract it
      results = data.data || [data];
    }

    return NextResponse.json({
      success: true,
      results,
      rowCount: results.length,
    });
  } catch (error) {
    console.error('Supabase SQL execution error:', error);
    return NextResponse.json({ error: 'Failed to execute query' }, { status: 500 });
  }
}
