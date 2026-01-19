import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

// Get all environment variables for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    const apiUrl = teamId
      ? `https://api.vercel.com/v9/projects/${id}/env?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${id}/env`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch environment variables' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ envs: data.envs });
  } catch (error) {
    console.error('Vercel env fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 });
  }
}

// Create or update an environment variable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, value, target = ['production', 'preview', 'development'], type = 'encrypted' } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    // First, check if the env var already exists
    const listUrl = teamId
      ? `https://api.vercel.com/v9/projects/${id}/env?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${id}/env`;

    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    let existingEnvId: string | null = null;
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const existing = listData.envs?.find((e: any) => e.key === key);
      if (existing) {
        existingEnvId = existing.id;
      }
    }

    let response;
    if (existingEnvId) {
      // Update existing env var
      const updateUrl = teamId
        ? `https://api.vercel.com/v9/projects/${id}/env/${existingEnvId}?teamId=${teamId}`
        : `https://api.vercel.com/v9/projects/${id}/env/${existingEnvId}`;

      response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value, target, type }),
      });
    } else {
      // Create new env var
      const createUrl = teamId
        ? `https://api.vercel.com/v10/projects/${id}/env?teamId=${teamId}`
        : `https://api.vercel.com/v10/projects/${id}/env`;

      response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value, target, type }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to set environment variable' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      env: data,
      updated: !!existingEnvId
    });
  } catch (error) {
    console.error('Vercel env update error:', error);
    return NextResponse.json({ error: 'Failed to set environment variable' }, { status: 500 });
  }
}

// Delete an environment variable
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { envId } = body;

    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    const apiUrl = teamId
      ? `https://api.vercel.com/v9/projects/${id}/env/${envId}?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${id}/env/${envId}`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to delete environment variable' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vercel env delete error:', error);
    return NextResponse.json({ error: 'Failed to delete environment variable' }, { status: 500 });
  }
}
