import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.cookies.get('vercel_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { target = 'production', deploymentId } = body;

    // If deploymentId is provided, redeploy that specific deployment
    // Otherwise, trigger a new deployment for the project
    let url = 'https://api.vercel.com/v13/deployments';
    let requestBody: any = {
      name: id, // Project name or ID
      target,
    };

    if (deploymentId) {
      // Redeploy existing deployment
      requestBody = {
        deploymentId,
        target,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to trigger redeploy' },
        { status: response.status }
      );
    }

    const deployment = await response.json();

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        url: deployment.url,
        state: deployment.state || deployment.readyState,
        createdAt: deployment.createdAt,
      },
    });
  } catch (error) {
    console.error('Vercel redeploy error:', error);
    return NextResponse.json({ error: 'Failed to trigger redeploy' }, { status: 500 });
  }
}
