import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationToken } from '@/lib/integrations/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for processing all brands

const BRAND_FACTORY_REPO = 'Light-Brands/brand-factory';
const BRANDS_PATH = 'brands';

// File patterns that indicate a project plan
const PLAN_PATTERNS = [
  /^project-plan\.md$/i,
  /^PROJECT-PLAN\.md$/,
  /^SPEC_OVERVIEW\.md$/i,
  /^\d+-implementation-roadmap\.md$/i,
  /^roadmap\.md$/i,
  /^plan\.md$/i,
  /^master-plan\.md$/i,
  /^MASTER-PLAN\.md$/,
];

// File patterns that indicate a brand identity
const IDENTITY_PATTERNS = [
  /^brand-identity\.md$/i,
  /^BRAND_IDENTITY_GUIDE\.md$/,
  /^brand-identity-guide\.md$/i,
  /^visual-identity\.md$/i,
  /^brand-guide\.md$/i,
];

// Files to check in spec/ subdirectory for plans
const SPEC_PLAN_FILES = [
  'MASTER-PLAN.md',
  'master-plan.md',
  'spec-overview.md',
  'SPEC-OVERVIEW.md',
];

// Files to check in spec/brand/ for identity
const SPEC_BRAND_FILES = [
  'visual-identity.md',
  'brand-voice-messaging.md',
  'brand-guidelines.md',
  'identity.md',
];

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

interface BrandAnalysis {
  name: string;
  files: GitHubFile[];
  planFile: GitHubFile | null;
  identityFile: GitHubFile | null;
  hasMetadata: boolean;
  hasStandardPlan: boolean;
  hasStandardIdentity: boolean;
}

interface StandardizationResult {
  brand: string;
  planCopied: boolean;
  identityCopied: boolean;
  metadataUpdated: boolean;
  errors: string[];
}

async function githubFetch(token: string, endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

async function listDirectory(token: string, path: string): Promise<GitHubFile[]> {
  const res = await githubFetch(token, `/repos/${BRAND_FACTORY_REPO}/contents/${path}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to list ${path}: ${res.status}`);
  }
  return res.json();
}

async function getFileContent(token: string, path: string): Promise<{ content: string; sha: string } | null> {
  const res = await githubFetch(token, `/repos/${BRAND_FACTORY_REPO}/contents/${path}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

async function createOrUpdateFile(
  token: string,
  filePath: string,
  content: string,
  message: string,
  existingSha?: string
): Promise<boolean> {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString('base64'),
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await githubFetch(token, `/repos/${BRAND_FACTORY_REPO}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  return res.ok;
}

function findPlanFile(files: GitHubFile[]): GitHubFile | null {
  for (const pattern of PLAN_PATTERNS) {
    const found = files.find(f => f.type === 'file' && pattern.test(f.name));
    if (found) return found;
  }
  return null;
}

function findIdentityFile(files: GitHubFile[]): GitHubFile | null {
  for (const pattern of IDENTITY_PATTERNS) {
    const found = files.find(f => f.type === 'file' && pattern.test(f.name));
    if (found) return found;
  }
  return null;
}

async function analyzeBrand(token: string, brandName: string): Promise<BrandAnalysis> {
  const brandPath = `${BRANDS_PATH}/${brandName}`;
  const files = await listDirectory(token, brandPath);

  let planFile = findPlanFile(files);
  let identityFile = findIdentityFile(files);
  const hasMetadata = files.some(f => f.name === 'metadata.json');
  const hasStandardPlan = files.some(f => f.name === 'project-plan.md');
  const hasStandardIdentity = files.some(f => f.name === 'brand-identity.md');

  // Check spec/ directory if no plan found
  if (!planFile && files.some(f => f.name === 'spec' && f.type === 'dir')) {
    const specFiles = await listDirectory(token, `${brandPath}/spec`);
    for (const specFile of SPEC_PLAN_FILES) {
      const found = specFiles.find(f => f.name.toLowerCase() === specFile.toLowerCase());
      if (found) {
        planFile = found;
        break;
      }
    }

    // Check spec/brand/ directory if no identity found
    if (!identityFile && specFiles.some(f => f.name === 'brand' && f.type === 'dir')) {
      const specBrandFiles = await listDirectory(token, `${brandPath}/spec/brand`);
      for (const brandFile of SPEC_BRAND_FILES) {
        const found = specBrandFiles.find(f => f.name.toLowerCase() === brandFile.toLowerCase());
        if (found) {
          identityFile = found;
          break;
        }
      }
    }
  }

  return {
    name: brandName,
    files,
    planFile,
    identityFile,
    hasMetadata,
    hasStandardPlan,
    hasStandardIdentity,
  };
}

function formatDisplayName(folderName: string): string {
  return folderName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function standardizeBrand(token: string, analysis: BrandAnalysis): Promise<StandardizationResult> {
  const brandPath = `${BRANDS_PATH}/${analysis.name}`;
  const result: StandardizationResult = {
    brand: analysis.name,
    planCopied: false,
    identityCopied: false,
    metadataUpdated: false,
    errors: [],
  };

  // Copy plan file if needed
  if (analysis.planFile && !analysis.hasStandardPlan) {
    const planData = await getFileContent(token, analysis.planFile.path);
    if (planData) {
      const success = await createOrUpdateFile(
        token,
        `${brandPath}/project-plan.md`,
        planData.content,
        `Standardize: Add project-plan.md for ${analysis.name}`
      );
      result.planCopied = success;
      if (!success) result.errors.push('Failed to copy plan file');
    }
  } else if (analysis.hasStandardPlan) {
    result.planCopied = true; // Already exists
  }

  // Copy identity file if needed
  if (analysis.identityFile && !analysis.hasStandardIdentity) {
    const identityData = await getFileContent(token, analysis.identityFile.path);
    if (identityData) {
      const success = await createOrUpdateFile(
        token,
        `${brandPath}/brand-identity.md`,
        identityData.content,
        `Standardize: Add brand-identity.md for ${analysis.name}`
      );
      result.identityCopied = success;
      if (!success) result.errors.push('Failed to copy identity file');
    }
  } else if (analysis.hasStandardIdentity) {
    result.identityCopied = true; // Already exists
  }

  // Create or update metadata.json
  const metadataFile = analysis.files.find(f => f.name === 'metadata.json');
  let existingMetadata: Record<string, unknown> = {};

  if (metadataFile) {
    const metaData = await getFileContent(token, metadataFile.path);
    if (metaData) {
      try {
        existingMetadata = JSON.parse(metaData.content);
      } catch {}
    }
  }

  const now = new Date().toISOString();
  const metadata = {
    brandName: existingMetadata.brandName || formatDisplayName(analysis.name),
    createdAt: existingMetadata.createdAt || now,
    updatedAt: now,
    createdBy: existingMetadata.createdBy || 'standardization',
    hasPlan: !!(analysis.planFile || analysis.hasStandardPlan),
    hasIdentity: !!(analysis.identityFile || analysis.hasStandardIdentity),
    originalPlanFile: analysis.planFile?.path || null,
    originalIdentityFile: analysis.identityFile?.path || null,
  };

  const metaSuccess = await createOrUpdateFile(
    token,
    `${brandPath}/metadata.json`,
    JSON.stringify(metadata, null, 2),
    `Standardize: ${metadataFile ? 'Update' : 'Add'} metadata.json for ${analysis.name}`,
    metadataFile?.sha
  );

  result.metadataUpdated = metaSuccess;
  if (!metaSuccess) result.errors.push('Failed to update metadata');

  return result;
}

/**
 * GET /api/builder/brands/standardize
 * Analyze all brands and return what would be standardized (dry run)
 */
export async function GET() {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const brandFolders = await listDirectory(token, BRANDS_PATH);
    const brands = brandFolders.filter(f => f.type === 'dir' && !f.name.startsWith('.'));

    const analyses: BrandAnalysis[] = [];
    for (const brand of brands) {
      const analysis = await analyzeBrand(token, brand.name);
      analyses.push(analysis);
    }

    const summary = {
      totalBrands: analyses.length,
      brandsWithPlans: analyses.filter(a => a.planFile || a.hasStandardPlan).length,
      brandsWithIdentities: analyses.filter(a => a.identityFile || a.hasStandardIdentity).length,
      brandsWithMetadata: analyses.filter(a => a.hasMetadata).length,
      needsStandardization: analyses.filter(
        a => (a.planFile && !a.hasStandardPlan) || (a.identityFile && !a.hasStandardIdentity) || !a.hasMetadata
      ).length,
    };

    const details = analyses.map(a => ({
      name: a.name,
      planFile: a.planFile?.name || (a.hasStandardPlan ? 'project-plan.md' : null),
      identityFile: a.identityFile?.name || (a.hasStandardIdentity ? 'brand-identity.md' : null),
      hasMetadata: a.hasMetadata,
      needsPlanCopy: !!(a.planFile && !a.hasStandardPlan),
      needsIdentityCopy: !!(a.identityFile && !a.hasStandardIdentity),
      needsMetadata: !a.hasMetadata,
    }));

    return NextResponse.json({ summary, details });
  } catch (error) {
    console.error('Error analyzing brands:', error);
    return NextResponse.json({ error: 'Failed to analyze brands' }, { status: 500 });
  }
}

/**
 * POST /api/builder/brands/standardize
 * Actually perform the standardization
 */
export async function POST(request: NextRequest) {
  const token = await getIntegrationToken('github');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { brands: targetBrands } = body as { brands?: string[] };

    const brandFolders = await listDirectory(token, BRANDS_PATH);
    let brands = brandFolders.filter(f => f.type === 'dir' && !f.name.startsWith('.'));

    // Filter to specific brands if requested
    if (targetBrands && targetBrands.length > 0) {
      brands = brands.filter(b => targetBrands.includes(b.name));
    }

    const results: StandardizationResult[] = [];

    for (const brand of brands) {
      const analysis = await analyzeBrand(token, brand.name);
      const result = await standardizeBrand(token, analysis);
      results.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const summary = {
      processed: results.length,
      plansCopied: results.filter(r => r.planCopied).length,
      identitiesCopied: results.filter(r => r.identityCopied).length,
      metadataUpdated: results.filter(r => r.metadataUpdated).length,
      errors: results.filter(r => r.errors.length > 0).length,
    };

    return NextResponse.json({ summary, results });
  } catch (error) {
    console.error('Error standardizing brands:', error);
    return NextResponse.json({ error: 'Failed to standardize brands' }, { status: 500 });
  }
}
