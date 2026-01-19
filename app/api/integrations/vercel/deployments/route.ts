import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = await getIntegrationToken('vercel');

  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected. Please connect your Vercel account in integrations.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const limit = searchParams.get('limit') || '20';
  const state = searchParams.get('state'); // BUILDING, ERROR, READY, CANCELED

  try {
    const url = new URL('https://api.vercel.com/v6/deployments');
    if (projectId) url.searchParams.set('projectId', projectId);
    url.searchParams.set('limit', limit);
    if (state) url.searchParams.set('state', state);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch deployments' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const deployments = data.deployments.map((d: any) => ({
      id: d.uid,
      name: d.name,
      url: d.url,
      state: d.state || d.readyState,
      createdAt: d.createdAt,
      buildingAt: d.buildingAt,
      ready: d.ready,
      target: d.target, // production, preview
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
    }));

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error('Vercel deployments fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch deployments' }, { status: 500 });
  }
}
