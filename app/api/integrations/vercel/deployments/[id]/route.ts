import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

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
    const response = await fetch(`https://api.vercel.com/v13/deployments/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch deployment' },
        { status: response.status }
      );
    }

    const d = await response.json();

    return NextResponse.json({
      deployment: {
        id: d.id,
        name: d.name,
        url: d.url,
        state: d.state || d.readyState,
        createdAt: d.createdAt,
        buildingAt: d.buildingAt,
        ready: d.ready,
        target: d.target,
        meta: {
          githubCommitRef: d.meta?.githubCommitRef,
          githubCommitSha: d.meta?.githubCommitSha,
          githubCommitMessage: d.meta?.githubCommitMessage,
          githubCommitAuthorName: d.meta?.githubCommitAuthorName,
        },
        creator: d.creator ? {
          username: d.creator.username,
          email: d.creator.email,
        } : null,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        errorStep: d.errorStep,
      },
    });
  } catch (error) {
    console.error('Vercel deployment fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch deployment' }, { status: 500 });
  }
}
