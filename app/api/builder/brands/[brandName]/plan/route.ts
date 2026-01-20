import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken, getGitHubUsername } from '@/lib/integrations/tokens';
import type { BrandMetadata } from '@/app/types/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_FACTORY_REPO = 'Light-Brands/brand-factory';
const BRANDS_PATH = 'brands';

interface RouteParams {
  params: Promise<{ brandName: string }>;
}

/**
 * GET /api/builder/brands/[brandName]/plan
 * Fetch the project-plan.md content for a brand
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const planUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}/project-plan.md`;
    const res = await fetch(planUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const file = await res.json();
    const content = Buffer.from(file.content, 'base64').toString('utf-8');

    return NextResponse.json({
      content,
      sha: file.sha,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 });
  }
}

/**
 * PUT /api/builder/brands/[brandName]/plan
 * Save/update the project-plan.md for a brand
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;
  const username = await getGitHubUsername();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content } = body as { content: string };

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Check if plan file already exists to get SHA
    const planPath = `${BRANDS_PATH}/${brandName}/project-plan.md`;
    const planUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${planPath}`;

    const checkRes = await fetch(planUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let sha: string | undefined;
    if (checkRes.ok) {
      const file = await checkRes.json();
      sha = file.sha;
    }

    // Save the plan file
    const saveRes = await fetch(planUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: sha ? `Update project plan: ${brandName}` : `Add project plan: ${brandName}`,
        content: Buffer.from(content).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });

    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.message || 'Failed to save plan');
    }

    const result = await saveRes.json();

    // Update metadata.json to reflect that plan exists
    await updateMetadata(token, brandName, { hasPlan: true }, username || undefined);

    return NextResponse.json({
      success: true,
      sha: result.content?.sha,
      commitSha: result.commit?.sha,
    });
  } catch (error) {
    console.error('Error saving plan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save plan' },
      { status: 500 }
    );
  }
}

// Helper to update metadata.json
async function updateMetadata(
  token: string,
  brandName: string,
  updates: Partial<BrandMetadata>,
  updatedBy?: string
): Promise<void> {
  try {
    const metadataPath = `${BRANDS_PATH}/${brandName}/metadata.json`;
    const metadataUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${metadataPath}`;

    // Fetch current metadata
    const res = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let currentMetadata: BrandMetadata | null = null;
    let sha: string | undefined;

    if (res.ok) {
      const file = await res.json();
      sha = file.sha;
      try {
        const content = Buffer.from(file.content, 'base64').toString('utf-8');
        currentMetadata = JSON.parse(content);
      } catch {
        // Ignore
      }
    }

    // Check for identity to set hasIdentity
    const folderRes = await fetch(
      `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    let hasIdentity = currentMetadata?.hasIdentity || false;
    if (folderRes.ok) {
      const files = await folderRes.json();
      hasIdentity = files.some((f: { name: string }) => f.name === 'brand-identity.md');
    }

    const now = new Date().toISOString();
    const newMetadata: BrandMetadata = {
      brandName: currentMetadata?.brandName || formatDisplayName(brandName),
      createdAt: currentMetadata?.createdAt || now,
      updatedAt: now,
      createdBy: currentMetadata?.createdBy || updatedBy || 'unknown',
      hasPlan: updates.hasPlan ?? currentMetadata?.hasPlan ?? false,
      hasIdentity: updates.hasIdentity ?? hasIdentity,
    };

    await fetch(metadataUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: `Update metadata: ${brandName}`,
        content: Buffer.from(JSON.stringify(newMetadata, null, 2)).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
    // Don't throw - metadata update is not critical
  }
}

function formatDisplayName(folderName: string): string {
  return folderName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
