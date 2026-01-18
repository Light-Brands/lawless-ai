import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const AI_CODING_CONFIG_REPO = 'TechNickAI/ai-coding-config';

// Only skip .git internals - literally everything else comes through
const SKIP_PREFIXES = ['.git/'];
const SKIP_FILES: string[] = [];

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
    const blobs = tree.tree.filter((item: { type: string; path: string; size?: number }) => {
      if (item.type !== 'blob') return false;
      if (item.size && item.size > 100000) return false;
      if (SKIP_FILES.includes(item.path)) return false;
      if (SKIP_PREFIXES.some(p => item.path.startsWith(p))) return false;
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

export async function POST(request: NextRequest) {
  const githubToken = request.cookies.get('github_token')?.value;
  const vercelToken = request.cookies.get('vercel_token')?.value;
  const supabaseToken = request.cookies.get('supabase_token')?.value;

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
              // Skip symlinks (they come through as text with the link target)
              if (content.length < 100 && !content.includes('\n')) continue;
              
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

          // Add environment variables if Supabase was created
          if (supabaseProject) {
            const envVars = [
              { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseProject.url },
            ];

            if (supabaseProject.anonKey) {
              envVars.push({ key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseProject.anonKey });
            }

            // Include teamId in env var API calls if creating under a team
            const envApiBase = vercelTeamId
              ? `https://api.vercel.com/v10/projects/${project.id}/env?teamId=${vercelTeamId}`
              : `https://api.vercel.com/v10/projects/${project.id}/env`;

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

    // Auto-link integrations to the repo
    const response = NextResponse.json({
      success: !hasError && !allSkipped,
      results,
      summary: {
        github: githubRepo,
        supabase: supabaseProject,
        vercel: vercelProject,
      },
    });

    // Save repo integrations to cookie if we have a GitHub repo
    if (githubRepo) {
      const existingIntegrations = request.cookies.get('repo_integrations')?.value;
      let integrations: Record<string, { vercel?: { projectId: string; projectName: string }; supabase?: { projectRef: string; projectName: string } }> = {};

      if (existingIntegrations) {
        try {
          integrations = JSON.parse(existingIntegrations);
        } catch {
          integrations = {};
        }
      }

      // Initialize repo entry
      if (!integrations[githubRepo.fullName]) {
        integrations[githubRepo.fullName] = {};
      }

      // Link Vercel project
      if (vercelProject) {
        integrations[githubRepo.fullName].vercel = {
          projectId: vercelProject.id,
          projectName: vercelProject.name,
        };
      }

      // Link Supabase project
      if (supabaseProject) {
        integrations[githubRepo.fullName].supabase = {
          projectRef: supabaseProject.ref,
          projectName: name,
        };
      }

      // Save to cookie
      response.cookies.set('repo_integrations', JSON.stringify(integrations), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    }

    return response;
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
    // from TechNickAI/ai-coding-config during project creation
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
    'README.md': `# ${projectName}

A full-stack application built with Next.js and Supabase.

## Getting Started

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Copy \`.env.local.example\` to \`.env.local\` and fill in your Supabase credentials
4. Run the development server: \`npm run dev\`

## AI Coding Setup

This project includes the full [ai-coding-config](https://github.com/TechNickAI/ai-coding-config) setup:

- \`.cursor/rules/\` - AI coding rules and standards
- \`.claude/\` - Claude Code configuration
- \`AGENTS.md\` - Project context for AI assistants

In Claude Code or Cursor, run \`/ai-coding-config\` to customize your setup or choose a personality.

## Tech Stack

- **Framework**: Next.js 14
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Language**: TypeScript

## Environment Variables

- \`NEXT_PUBLIC_SUPABASE_URL\` - Your Supabase project URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` - Your Supabase anon/public key

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [AI Coding Config](https://github.com/TechNickAI/ai-coding-config)
`,
  };
}
