import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const AI_CODING_CONFIG_REPO = 'Light-Brands/local-ide';

// Only skip .git/ internals (object database), NOT .github/
const SKIP_PREFIX = '.git/';

const SUBMODULE_REPOS = [
  { path: 'ai-coding-config', repo: 'Light-Brands/ai-coding-config' },
  { path: 'bmad-method', repo: 'Light-Brands/bmad-method' },
];

// Fetch entire repo using Git Trees API (2 API calls instead of hundreds)
async function fetchAiCodingConfig(token: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  try {
    // 1. Get the default branch SHA
    const repoRes = await fetch(`https://api.github.com/repos/${AI_CODING_CONFIG_REPO}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!repoRes.ok) return files;
    const repo = await repoRes.json();
    const defaultBranch = repo.default_branch;

    // 2. Get the entire tree recursively (ONE API call for all files)
    const treeRes = await fetch(
      `https://api.github.com/repos/${AI_CODING_CONFIG_REPO}/git/trees/${defaultBranch}?recursive=1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!treeRes.ok) return files;
    const tree = await treeRes.json();

    // 3. Filter and fetch blobs in parallel
    const blobs = tree.tree.filter((item: { type: string; path: string }) => {
      if (item.type !== 'blob') return false;
      // Only skip .git/ internals — allow .github/, all sizes, everything else
      if (item.path.startsWith(SKIP_PREFIX) && !item.path.startsWith('.github/')) return false;
      return true;
    });

    // Fetch all file contents in parallel (batched)
    const batchSize = 20;
    for (let i = 0; i < blobs.length; i += batchSize) {
      const batch = blobs.slice(i, i + batchSize);
      const contents = await Promise.all(
        batch.map(async (blob: { path: string; sha: string }) => {
          const res = await fetch(
            `https://api.github.com/repos/${AI_CODING_CONFIG_REPO}/git/blobs/${blob.sha}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (!res.ok) return null;
          const data = await res.json();
          // Decode base64 content
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return { path: blob.path, content };
        })
      );
      for (const item of contents) {
        if (item) files[item.path] = item.content;
      }
    }
  } catch (error) {
    console.error('Error fetching ai-coding-config:', error);
  }

  return files;
}

interface CreateProjectRequest {
  name: string;
  description?: string;
  isPrivate?: boolean;
  includeGitHub?: boolean;
  includeVercel?: boolean;
  includeSupabase?: boolean;
  supabaseRegion?: string;
  githubOrg?: string;
  vercelTeamId?: string;
  supabaseOrgId?: string;
}

interface StepResult {
  step: string;
  status: 'success' | 'error' | 'skipped';
  data?: Record<string, unknown>;
  error?: string;
}

// Fetch Supabase API keys for a project
async function fetchSupabaseApiKeys(
  token: string,
  projectRef: string,
  maxAttempts = 10
): Promise<{ anonKey: string; serviceKey: string } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const keys = await response.json();
        const anonKey = keys.find((k: { name: string }) => k.name === 'anon')?.api_key;
        const serviceKey = keys.find((k: { name: string }) => k.name === 'service_role')?.api_key;

        if (anonKey && serviceKey) {
          return { anonKey, serviceKey };
        }
      }
    } catch (error) {
      console.error('Error fetching Supabase keys:', error);
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return null;
}

// Add git submodules using the Git Data API (mode 160000 requires tree-level operations)
async function addSubmodules(
  token: string,
  repoFullName: string,
  branch: string = 'main'
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Get current HEAD SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
    { headers }
  );
  if (!refRes.ok) throw new Error('Failed to get branch ref');
  const refData = await refRes.json();
  const headSha = refData.object.sha;

  // 2. Get current commit's tree SHA
  const commitRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/commits/${headSha}`,
    { headers }
  );
  if (!commitRes.ok) throw new Error('Failed to get commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Get HEAD SHA for each submodule repo (parallel)
  const submoduleShas = await Promise.all(
    SUBMODULE_REPOS.map(async (sub) => {
      const res = await fetch(
        `https://api.github.com/repos/${sub.repo}/git/refs/heads/main`,
        { headers }
      );
      if (!res.ok) throw new Error(`Failed to get HEAD for ${sub.repo}`);
      const data = await res.json();
      return { ...sub, sha: data.object.sha };
    })
  );

  // 4. Build .gitmodules content
  const gitmodulesContent = SUBMODULE_REPOS.map(
    (sub) =>
      `[submodule "${sub.path}"]\n\tpath = ${sub.path}\n\turl = https://github.com/${sub.repo}.git`
  ).join('\n');

  // 5. Create new tree with base_tree (preserves existing files)
  const treeEntries = [
    {
      path: '.gitmodules',
      mode: '100644',
      type: 'blob',
      content: gitmodulesContent,
    },
    ...submoduleShas.map((sub) => ({
      path: sub.path,
      mode: '160000',
      type: 'commit',
      sha: sub.sha,
    })),
  ];

  const treeRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/trees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    }
  );
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 6. Create commit
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'Add ai-coding-config and bmad-method submodules',
        tree: treeData.sha,
        parents: [headSha],
      }),
    }
  );
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // 7. Update branch ref
  const updateRefRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha }),
    }
  );
  if (!updateRefRes.ok) throw new Error('Failed to update branch ref');
}

export async function POST(request: NextRequest) {
  // Get tokens from database
  const { getIntegrationToken } = await import('@/lib/integrations/tokens');
  const githubToken = await getIntegrationToken('github');
  const vercelToken = await getIntegrationToken('vercel');
  const supabaseToken = await getIntegrationToken('supabase_pat');

  try {
    const body: CreateProjectRequest = await request.json();
    const {
      name,
      description,
      isPrivate = true,
      includeGitHub = true,
      includeVercel = true,
      includeSupabase = true,
      supabaseRegion = 'us-east-1',
      githubOrg,
      vercelTeamId,
      supabaseOrgId,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Validate tokens for requested services
    if (includeGitHub && !githubToken) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
    }
    if (includeVercel && !vercelToken) {
      return NextResponse.json({ error: 'Vercel not connected' }, { status: 401 });
    }
    if (includeSupabase && !supabaseToken) {
      return NextResponse.json({ error: 'Supabase not connected (PAT required)' }, { status: 401 });
    }

    const results: StepResult[] = [];
    let githubRepo: { fullName: string; htmlUrl: string; owner: string } | null = null;
    let supabaseProject: { ref: string; url: string; anonKey?: string } | null = null;
    let vercelProject: { id: string; name: string } | null = null;

    // Step 1: Create Supabase project first (takes longest to provision)
    if (includeSupabase) {
      try {
        // Use provided org ID or fetch the first org
        let orgId = supabaseOrgId;

        if (!orgId) {
          const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
            headers: { 'Authorization': `Bearer ${supabaseToken}` },
          });
          const orgs = await orgsResponse.json();
          orgId = orgs[0]?.id;
        }

        if (!orgId) {
          results.push({
            step: 'supabase',
            status: 'error',
            error: 'No Supabase organization found',
          });
        } else {
          // Generate password
          const dbPassword = generateSecurePassword();

          // Create project
          const createResponse = await fetch('https://api.supabase.com/v1/projects', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              organization_id: orgId,
              region: supabaseRegion,
              db_pass: dbPassword,
              plan: 'free',
            }),
          });

          if (createResponse.ok) {
            const project = await createResponse.json();
            supabaseProject = {
              ref: project.ref,
              url: `https://${project.ref}.supabase.co`,
            };

            results.push({
              step: 'supabase',
              status: 'success',
              data: {
                ref: project.ref,
                url: supabaseProject.url,
                region: project.region,
                dbPassword, // User needs this!
              },
            });
          } else {
            const error = await createResponse.json();
            results.push({
              step: 'supabase',
              status: 'error',
              error: error.message || 'Failed to create Supabase project',
            });
          }
        }
      } catch (error) {
        results.push({
          step: 'supabase',
          status: 'error',
          error: error instanceof Error ? error.message : 'Supabase creation failed',
        });
      }
    } else {
      results.push({ step: 'supabase', status: 'skipped' });
    }

    // Step 2: Create GitHub repository with template
    if (includeGitHub) {
      try {
        // Use different endpoint for org vs personal repos
        const githubApiUrl = githubOrg
          ? `https://api.github.com/orgs/${githubOrg}/repos`
          : 'https://api.github.com/user/repos';

        // Create repo
        const createResponse = await fetch(githubApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: description || `${name} - Built with Next.js and Supabase`,
            private: isPrivate,
            auto_init: false,
          }),
        });

        if (createResponse.ok) {
          const repo = await createResponse.json();
          githubRepo = {
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            owner: repo.owner.login,
          };

          // Add template files
          const templateFiles = getTemplateFiles(name, supabaseProject?.url, supabaseProject?.anonKey);

          for (const [filePath, content] of Object.entries(templateFiles)) {
            const encodedContent = Buffer.from(content).toString('base64');
            await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${filePath}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Add ${filePath}`,
                content: encodedContent,
              }),
            });
          }

          // Fetch and add ai-coding-config files from TechNickAI repo
          try {
            const aiConfigFiles = await fetchAiCodingConfig(githubToken!);
            
            for (const [filePath, content] of Object.entries(aiConfigFiles)) {
              const encodedContent = Buffer.from(content).toString('base64');
              await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${githubToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: `Add ${filePath} from ai-coding-config`,
                  content: encodedContent,
                }),
              });
            }
          } catch (error) {
            console.error('Failed to add ai-coding-config files:', error);
            // Don't fail the whole project creation, just log the error
          }

          // Add git submodules (ai-coding-config + bmad-method)
          try {
            await addSubmodules(githubToken!, repo.full_name);
          } catch (submoduleError) {
            console.error('Failed to add submodules:', submoduleError);
            // Non-fatal — don't break project creation
          }

          results.push({
            step: 'github',
            status: 'success',
            data: {
              fullName: repo.full_name,
              htmlUrl: repo.html_url,
              private: repo.private,
            },
          });
        } else {
          const error = await createResponse.json();
          results.push({
            step: 'github',
            status: 'error',
            error: error.message || 'Failed to create GitHub repository',
          });
        }
      } catch (error) {
        results.push({
          step: 'github',
          status: 'error',
          error: error instanceof Error ? error.message : 'GitHub creation failed',
        });
      }
    } else {
      results.push({ step: 'github', status: 'skipped' });
    }

    // Step 3: Fetch Supabase API keys (they take time to generate)
    if (supabaseProject && supabaseToken) {
      const keys = await fetchSupabaseApiKeys(supabaseToken, supabaseProject.ref);
      if (keys) {
        supabaseProject.anonKey = keys.anonKey;
        // Update the result with the anon key
        const supabaseResult = results.find(r => r.step === 'supabase');
        if (supabaseResult && supabaseResult.data) {
          supabaseResult.data.anonKey = keys.anonKey;
        }
      }
    }

    // Step 4: Create Vercel project and link to GitHub
    if (includeVercel && githubRepo) {
      try {
        const projectPayload: Record<string, unknown> = {
          name,
          framework: 'nextjs',
          gitRepository: {
            type: 'github',
            repo: githubRepo.fullName,
          },
        };

        // Add teamId query param if creating under a team
        const vercelApiUrl = vercelTeamId
          ? `https://api.vercel.com/v9/projects?teamId=${vercelTeamId}`
          : 'https://api.vercel.com/v9/projects';

        const createResponse = await fetch(vercelApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectPayload),
        });

        if (createResponse.ok) {
          const project = await createResponse.json();
          vercelProject = {
            id: project.id,
            name: project.name,
          };

          // Include teamId in env var API calls if creating under a team
          const envApiBase = vercelTeamId
            ? `https://api.vercel.com/v10/projects/${project.id}/env?teamId=${vercelTeamId}`
            : `https://api.vercel.com/v10/projects/${project.id}/env`;

          // Enable deep clone so Vercel initializes git submodules
          await fetch(envApiBase, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${vercelToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: 'VERCEL_DEEP_CLONE',
              value: 'true',
              type: 'encrypted',
              target: ['production', 'preview', 'development'],
            }),
          });

          // Add Supabase environment variables if available
          if (supabaseProject) {
            const envVars = [
              { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseProject.url },
            ];

            if (supabaseProject.anonKey) {
              envVars.push({ key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseProject.anonKey });
            }

            for (const envVar of envVars) {
              await fetch(envApiBase, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${vercelToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: envVar.key,
                  value: envVar.value,
                  type: 'encrypted',
                  target: ['production', 'preview', 'development'],
                }),
              });
            }
          }

          results.push({
            step: 'vercel',
            status: 'success',
            data: {
              id: project.id,
              name: project.name,
              url: `https://${project.name}.vercel.app`,
            },
          });
        } else {
          const error = await createResponse.json();
          results.push({
            step: 'vercel',
            status: 'error',
            error: error.error?.message || 'Failed to create Vercel project',
          });
        }
      } catch (error) {
        results.push({
          step: 'vercel',
          status: 'error',
          error: error instanceof Error ? error.message : 'Vercel creation failed',
        });
      }
    } else if (includeVercel && !githubRepo) {
      results.push({
        step: 'vercel',
        status: 'error',
        error: 'Cannot create Vercel project without GitHub repository',
      });
    } else {
      results.push({ step: 'vercel', status: 'skipped' });
    }

    // Determine overall success
    const hasError = results.some(r => r.status === 'error');
    const allSkipped = results.every(r => r.status === 'skipped');

    // Auto-link integrations to the repo in database
    if (githubRepo && (vercelProject || supabaseProject)) {
      try {
        const { createClient, createServiceClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;

        if (githubUsername) {
          const serviceClient = createServiceClient();
          await serviceClient
            .from('repo_integrations')
            .upsert({
              user_id: githubUsername,
              repo_full_name: githubRepo.fullName,
              vercel_project_id: vercelProject?.id || null,
              supabase_project_ref: supabaseProject?.ref || null,
              updated_at: new Date().toISOString(),
            } as never, { onConflict: 'user_id,repo_full_name' });
        }
      } catch (dbError) {
        console.error('Error saving repo integrations:', dbError);
        // Continue anyway - projects were created
      }
    }

    return NextResponse.json({
      success: !hasError && !allSkipped,
      results,
      summary: {
        github: githubRepo,
        supabase: supabaseProject,
        vercel: vercelProject,
      },
    });
  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function getTemplateFiles(projectName: string, supabaseUrl?: string, supabaseKey?: string): Record<string, string> {
  return {
    'package.json': `{
  "name": "${projectName}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "next": "14.0.4",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.0.4",
    "typescript": "^5"
  }
}`,
    // Note: AI coding config files (.cursor, .claude, AGENTS.md) are pulled fresh
    // from Light-Brands/local-ide during project creation
    'tsconfig.json': `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
    'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig`,
    '.gitignore': `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts`,
    '.env.local.example': `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'your-project-url'}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseKey || 'your-anon-key'}`,
    'lib/supabase.ts': `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)`,
    'app/layout.tsx': `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Built with Next.js and Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`,
    'app/globals.css': `:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-rgb: 10, 10, 15;
  }
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}`,
    'app/page.tsx': `export default function Home() {
  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          ${projectName}
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Your Next.js + Supabase project is ready!
        </p>

        <div style={{
          background: '#f5f5f5',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Getting Started
          </h2>
          <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
            <li>Create tables in your Supabase dashboard</li>
            <li>Import the supabase client from lib/supabase.ts</li>
            <li>Start building your app!</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            style={{ color: '#0070f3', textDecoration: 'none' }}
          >
            Next.js Docs →
          </a>
          <a
            href="https://supabase.com/docs"
            target="_blank"
            style={{ color: '#3ECF8E', textDecoration: 'none' }}
          >
            Supabase Docs →
          </a>
        </div>
      </div>
    </main>
  )
}`,
  };
}
