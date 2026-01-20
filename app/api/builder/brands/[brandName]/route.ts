import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';
import type { Brand, BrandMetadata, BrandResponse } from '@/app/types/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_FACTORY_REPO = 'TechNickAI/brand-factory';
const BRANDS_PATH = 'brands';

interface RouteParams {
  params: Promise<{ brandName: string }>;
}

/**
 * GET /api/builder/brands/[brandName]
 * Fetch a specific brand's details including plan and identity content
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Fetch the brand folder contents
    const folderUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}`;
    const folderRes = await fetch(folderUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!folderRes.ok) {
      if (folderRes.status === 404) {
        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${folderRes.status}`);
    }

    const files = await folderRes.json();
    const fileNames = files.map((f: { name: string }) => f.name);

    const hasPlan = fileNames.includes('project-plan.md');
    const hasIdentity = fileNames.includes('brand-identity.md');

    // Fetch file contents in parallel
    const [planContent, identityContent, metadataContent] = await Promise.all([
      hasPlan ? fetchFileContent(token, `${BRANDS_PATH}/${brandName}/project-plan.md`) : null,
      hasIdentity ? fetchFileContent(token, `${BRANDS_PATH}/${brandName}/brand-identity.md`) : null,
      fileNames.includes('metadata.json')
        ? fetchFileContent(token, `${BRANDS_PATH}/${brandName}/metadata.json`)
        : null,
    ]);

    let metadata: BrandMetadata | null = null;
    if (metadataContent) {
      try {
        metadata = JSON.parse(metadataContent);
      } catch {
        // Ignore invalid JSON
      }
    }

    const brand: Brand = {
      name: brandName,
      displayName: metadata?.brandName || formatDisplayName(brandName),
      hasPlan,
      hasIdentity,
      isComplete: hasPlan && hasIdentity,
      createdAt: metadata?.createdAt,
      updatedAt: metadata?.updatedAt,
      createdBy: metadata?.createdBy,
    };

    const response: BrandResponse = {
      brand,
      plan: planContent || undefined,
      identity: identityContent || undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 });
  }
}

/**
 * PUT /api/builder/brands/[brandName]
 * Update a brand's metadata
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName } = body as { displayName?: string };

    // First, get the current metadata file to get its SHA
    const metadataPath = `${BRANDS_PATH}/${brandName}/metadata.json`;
    const metadataUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${metadataPath}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let sha: string | undefined;
    let currentMetadata: BrandMetadata | null = null;

    if (metadataRes.ok) {
      const file = await metadataRes.json();
      sha = file.sha;
      try {
        const content = Buffer.from(file.content, 'base64').toString('utf-8');
        currentMetadata = JSON.parse(content);
      } catch {
        // Ignore
      }
    }

    // Check if plan and identity exist
    const folderRes = await fetch(`https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let hasPlan = false;
    let hasIdentity = false;

    if (folderRes.ok) {
      const files = await folderRes.json();
      const fileNames = files.map((f: { name: string }) => f.name);
      hasPlan = fileNames.includes('project-plan.md');
      hasIdentity = fileNames.includes('brand-identity.md');
    }

    // Update metadata
    const now = new Date().toISOString();
    const newMetadata: BrandMetadata = {
      brandName: displayName || currentMetadata?.brandName || formatDisplayName(brandName),
      createdAt: currentMetadata?.createdAt || now,
      updatedAt: now,
      createdBy: currentMetadata?.createdBy || 'unknown',
      hasPlan,
      hasIdentity,
    };

    const updateRes = await fetch(metadataUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: `Update brand metadata: ${brandName}`,
        content: Buffer.from(JSON.stringify(newMetadata, null, 2)).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || 'Failed to update brand');
    }

    const result = await updateRes.json();

    return NextResponse.json({
      success: true,
      brand: {
        name: brandName,
        displayName: newMetadata.brandName,
        hasPlan,
        hasIdentity,
        isComplete: hasPlan && hasIdentity,
        createdAt: newMetadata.createdAt,
        updatedAt: newMetadata.updatedAt,
        createdBy: newMetadata.createdBy,
      },
      commitSha: result.commit?.sha,
    });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update brand' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/builder/brands/[brandName]
 * Delete a brand folder (all files)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const token = await getIntegrationToken('github');
  const { brandName } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get all files in the brand folder
    const folderUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${brandName}`;
    const folderRes = await fetch(folderUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!folderRes.ok) {
      if (folderRes.status === 404) {
        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      }
      throw new Error(`GitHub API error: ${folderRes.status}`);
    }

    const files = await folderRes.json();

    // Delete each file in the folder
    for (const file of files) {
      const fileUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${file.path}`;
      await fetch(fileUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `Delete brand: ${brandName}`,
          sha: file.sha,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete brand' },
      { status: 500 }
    );
  }
}

// Helper to fetch file content from GitHub
async function fetchFileContent(token: string, path: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) return null;

    const file = await res.json();
    return Buffer.from(file.content, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

// Helper to format folder name as display name
function formatDisplayName(folderName: string): string {
  return folderName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
