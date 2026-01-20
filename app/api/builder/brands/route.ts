import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';
import type { Brand, BrandMetadata, BrandsListResponse } from '@/app/types/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Central repository for all brands
const BRAND_FACTORY_REPO = 'Light-Brands/brand-factory';
const BRANDS_PATH = 'brands';

/**
 * GET /api/builder/brands
 * List all brands from the brand-factory repository
 */
export async function GET() {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get the brands directory contents
    const brandsUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}`;
    const response = await fetch(brandsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // brands/ folder doesn't exist yet, return empty list
        return NextResponse.json({ brands: [] } as BrandsListResponse);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents = await response.json();

    // Filter to only directories (brand folders)
    const brandFolders = contents.filter(
      (item: { type: string; name: string }) => item.type === 'dir' && !item.name.startsWith('.')
    );

    // Fetch details for each brand folder
    const brands: Brand[] = await Promise.all(
      brandFolders.map(async (folder: { name: string; path: string }) => {
        const brandName = folder.name;
        let hasPlan = false;
        let hasIdentity = false;
        let metadata: BrandMetadata | null = null;

        // Check what files exist in the brand folder
        try {
          const folderUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${folder.path}`;
          const folderRes = await fetch(folderUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          });

          if (folderRes.ok) {
            const files = await folderRes.json();
            const fileNames = files.map((f: { name: string }) => f.name);

            hasPlan = fileNames.includes('project-plan.md');
            hasIdentity = fileNames.includes('brand-identity.md');

            // Try to fetch metadata.json
            if (fileNames.includes('metadata.json')) {
              const metadataUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${folder.path}/metadata.json`;
              const metadataRes = await fetch(metadataUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
              });
              if (metadataRes.ok) {
                const metadataFile = await metadataRes.json();
                const content = Buffer.from(metadataFile.content, 'base64').toString('utf-8');
                metadata = JSON.parse(content);
              }
            }
          }
        } catch (e) {
          console.error(`Error checking brand folder ${brandName}:`, e);
        }

        return {
          name: brandName,
          displayName: metadata?.brandName || formatDisplayName(brandName),
          hasPlan,
          hasIdentity,
          isComplete: hasPlan && hasIdentity,
          createdAt: metadata?.createdAt,
          updatedAt: metadata?.updatedAt,
          createdBy: metadata?.createdBy,
        };
      })
    );

    // Sort by updated date (newest first), then by name
    brands.sort((a, b) => {
      if (a.updatedAt && b.updatedAt) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (a.updatedAt) return -1;
      if (b.updatedAt) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ brands } as BrandsListResponse);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

/**
 * POST /api/builder/brands
 * Create a new brand folder in brand-factory
 */
export async function POST(request: NextRequest) {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { brandName, createdBy } = body as { brandName: string; createdBy?: string };

    if (!brandName) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    // Convert to folder-safe name (lowercase, hyphens instead of spaces)
    const folderName = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!folderName) {
      return NextResponse.json({ error: 'Invalid brand name' }, { status: 400 });
    }

    // Check if brand already exists
    const checkUrl = `https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${BRANDS_PATH}/${folderName}`;
    const checkRes = await fetch(checkUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (checkRes.ok) {
      return NextResponse.json({ error: 'Brand already exists' }, { status: 409 });
    }

    // Create metadata.json as the initial file (creates the folder)
    const now = new Date().toISOString();
    const metadata: BrandMetadata = {
      brandName,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'unknown',
      hasPlan: false,
      hasIdentity: false,
    };

    const metadataPath = `${BRANDS_PATH}/${folderName}/metadata.json`;
    const createRes = await fetch(`https://api.github.com/repos/${BRAND_FACTORY_REPO}/contents/${metadataPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: `Create brand: ${brandName}`,
        content: Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64'),
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || 'Failed to create brand');
    }

    const result = await createRes.json();

    const brand: Brand = {
      name: folderName,
      displayName: brandName,
      hasPlan: false,
      hasIdentity: false,
      isComplete: false,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'unknown',
    };

    return NextResponse.json({
      success: true,
      brand,
      commitSha: result.commit?.sha,
    });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create brand' },
      { status: 500 }
    );
  }
}

// Helper to format folder name as display name
function formatDisplayName(folderName: string): string {
  return folderName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
