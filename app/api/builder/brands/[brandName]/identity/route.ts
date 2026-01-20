import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken, getGitHubUsername } from '@/lib/integrations/tokens';
import type { BrandMetadata } from '@/app/types/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_FACTORY_REPO = 'TechNickAI/brand-factory';
const BRANDS_PATH = 'brands';

interface RouteParams {
  params: Promise<{ brandName: string }>;
}

/**
 * GET /api/builder/brands/[brandName]/identity
 * Fetch the brand-identity.md content for a brand
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const identityUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}/brand-identity.md`;
    const res = await fetch(identityUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
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
    console.error('Error fetching identity:', error);
    return NextResponse.json({ error: 'Failed to fetch identity' }, { status: 500 });
  }
}

/**
 * PUT /api/builder/brands/[brandName]/identity
 * Save/update the brand-identity.md for a brand
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

    // Check if identity file already exists to get SHA
    const identityPath = `${BRANDS_PATH}/${brandName}/brand-identity.md`;
    const identityUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${identityPath}`;

    const checkRes = await fetch(identityUrl, {
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

    // Save the identity file
    const saveRes = await fetch(identityUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: sha ? `Update brand identity: ${brandName}` : `Add brand identity: ${brandName}`,
        content: Buffer.from(content).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });

    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.message || 'Failed to save identity');
    }

    const result = await saveRes.json();

    // Update metadata.json to reflect that identity exists
    await updateMetadata(token, brandName, { hasIdentity: true }, username || undefined);

    return NextResponse.json({
      success: true,
      sha: result.content?.sha,
      commitSha: result.commit?.sha,
    });
  } catch (error) {
    console.error('Error saving identity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save identity' },
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

    // Check for plan to set hasPlan
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

    let hasPlan = currentMetadata?.hasPlan || false;
    if (folderRes.ok) {
      const files = await folderRes.json();
      hasPlan = files.some((f: { name: string }) => f.name === 'project-plan.md');
    }

    const now = new Date().toISOString();
    const newMetadata: BrandMetadata = {
      brandName: currentMetadata?.brandName || formatDisplayName(brandName),
      createdAt: currentMetadata?.createdAt || now,
      updatedAt: now,
      createdBy: currentMetadata?.createdBy || updatedBy || 'unknown',
      hasPlan: updates.hasPlan ?? hasPlan,
      hasIdentity: updates.hasIdentity ?? currentMetadata?.hasIdentity ?? false,
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
