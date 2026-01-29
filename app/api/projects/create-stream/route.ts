import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const AI_CODING_CONFIG_REPO = 'Light-Brands/local-ide';
// Only skip .git internals - literally everything else comes through
const SKIP_PREFIXES = ['.git/'];
const SKIP_FILES: string[] = [];

// Helper to send SSE messages
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

// Helper to fetch content from a URL
async function fetchDocumentContent(url: string): Promise<string | null> {
  try {
    // Handle Google Docs URLs - convert to export URL
    if (url.includes('docs.google.com/document')) {
      const docIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (docIdMatch) {
        const docId = docIdMatch[1];
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const response = await fetch(exportUrl);
        if (response.ok) {
          return await response.text();
        }
      }
    }

    // Try to fetch directly
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle different content types
    if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      return await response.text();
    }

    // For HTML, try to extract text content
    if (contentType.includes('text/html')) {
      const html = await response.text();
      // Basic HTML to text conversion - strip tags
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return text;
    }

    // Default to text
    return await response.text();
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return null;
  }
}

// Fetch entire repo using Git Trees API
async function fetchAiCodingConfig(
  token: string,
  onProgress: (msg: string) => void
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  onProgress('Fetching ai-coding-config repository...');

  const repoRes = await fetch(`https://api.github.com/repos/${AI_CODING_CONFIG_REPO}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!repoRes.ok) throw new Error('Failed to fetch repo info');
  const repo = await repoRes.json();

  onProgress('Getting file tree...');
  const treeRes = await fetch(
    `https://api.github.com/repos/${AI_CODING_CONFIG_REPO}/git/trees/${repo.default_branch}?recursive=1`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!treeRes.ok) throw new Error('Failed to fetch tree');
  const tree = await treeRes.json();

  const blobs = tree.tree.filter((item: { type: string; path: string; size?: number }) => {
    if (item.type !== 'blob') return false;
    if (item.size && item.size > 100000) return false;
    if (SKIP_FILES.includes(item.path)) return false;
    if (SKIP_PREFIXES.some(p => item.path.startsWith(p))) return false;
    return true;
  });

  onProgress(`Downloading ${blobs.length} files...`);

  const batchSize = 20;
  for (let i = 0; i < blobs.length; i += batchSize) {
    const batch = blobs.slice(i, i + batchSize);
    const progress = Math.round(((i + batch.length) / blobs.length) * 100);
    onProgress(`Downloading files... ${progress}%`);

    const contents = await Promise.all(
      batch.map(async (blob: { path: string; sha: string }) => {
        const res = await fetch(
          `https://api.github.com/repos/${AI_CODING_CONFIG_REPO}/git/blobs/${blob.sha}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return { path: blob.path, content: Buffer.from(data.content, 'base64').toString('utf-8') };
      })
    );
    for (const item of contents) {
      if (item) files[item.path] = item.content;
    }
  }

  return files;
}

export async function POST(request: NextRequest) {
  // Get tokens from database
  const { getIntegrationToken } = await import('@/lib/integrations/tokens');
  const githubToken = await getIntegrationToken('github');
  const vercelToken = await getIntegrationToken('vercel');
  const supabaseToken = await getIntegrationToken('supabase_pat');

  interface DocumentInput {
    type: 'link' | 'upload';
    url?: string;
    content?: string;
    filename?: string;
  }

  const body = await request.json();
  const {
    name,
    description,
    isPrivate = true,
    includeAiConfig = true,
    includeVercel = true,
    includeSupabase = true,
    supabaseRegion = 'us-east-1',
    githubOrg,
    vercelTeamId,
    supabaseOrgId,
    projectPlan,
    brandIdentity,
  } = body as {
    name: string;
    description?: string;
    isPrivate?: boolean;
    includeAiConfig?: boolean;
    includeVercel?: boolean;
    includeSupabase?: boolean;
    supabaseRegion?: string;
    githubOrg?: string;
    vercelTeamId?: string;
    supabaseOrgId?: string;
    projectPlan?: DocumentInput;
    brandIdentity?: DocumentInput;
  };

  if (!name || !githubToken) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const progress = (msg: string) => sendEvent(controller, 'progress', { message: msg });
      const stepComplete = (step: string, data: unknown) => sendEvent(controller, 'step', { step, status: 'success', data });
      const stepError = (step: string, error: string) => sendEvent(controller, 'step', { step, status: 'error', error });

      try {
        let githubRepo: { fullName: string; htmlUrl: string } | null = null;
        let supabaseProject: { ref: string; url: string; anonKey?: string; dbPassword?: string } | null = null;
        let vercelProject: { id: string; name: string; url: string } | null = null;

        // Step 1: Create Supabase project (takes longest)
        if (includeSupabase && supabaseToken) {
          progress('Creating Supabase database...');
          try {
            let orgId = supabaseOrgId;
            if (!orgId) {
              const orgsRes = await fetch('https://api.supabase.com/v1/organizations', {
                headers: { 'Authorization': `Bearer ${supabaseToken}` },
              });
              const orgs = await orgsRes.json();
              orgId = orgs[0]?.id;
            }

            if (orgId) {
              const dbPassword = generatePassword();
              const createRes = await fetch('https://api.supabase.com/v1/projects', {
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

              if (createRes.ok) {
                const project = await createRes.json();
                supabaseProject = {
                  ref: project.ref,
                  url: `https://${project.ref}.supabase.co`,
                  dbPassword,
                };
                stepComplete('supabase', { ref: project.ref, url: supabaseProject.url, dbPassword });
              } else {
                const err = await createRes.json();
                stepError('supabase', err.message || 'Failed to create');
              }
            }
          } catch (e) {
            stepError('supabase', e instanceof Error ? e.message : 'Failed');
          }
        }

        // Step 2: Create GitHub repo
        progress('Creating GitHub repository...');
        try {
          const githubApiUrl = githubOrg
            ? `https://api.github.com/orgs/${githubOrg}/repos`
            : 'https://api.github.com/user/repos';

          const createRes = await fetch(githubApiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              description: description || `${name} - Built with Next.js`,
              private: isPrivate,
              auto_init: false,
            }),
          });

          if (createRes.ok) {
            const repo = await createRes.json();
            githubRepo = { fullName: repo.full_name, htmlUrl: repo.html_url };

            // Resolve document content from links if needed
            let projectPlanContent: string | null = null;
            let brandIdentityContent: string | null = null;

            if (projectPlan) {
              if (projectPlan.type === 'upload' && projectPlan.content) {
                projectPlanContent = projectPlan.content;
              } else if (projectPlan.type === 'link' && projectPlan.url) {
                progress('Fetching project plan from URL...');
                projectPlanContent = await fetchDocumentContent(projectPlan.url);
              }
            }

            if (brandIdentity) {
              if (brandIdentity.type === 'upload' && brandIdentity.content) {
                brandIdentityContent = brandIdentity.content;
              } else if (brandIdentity.type === 'link' && brandIdentity.url) {
                progress('Fetching brand identity from URL...');
                brandIdentityContent = await fetchDocumentContent(brandIdentity.url);
              }
            }

            // Add template files
            progress('Adding template files...');
            const templateFiles = getTemplateFiles(name, supabaseProject?.url, projectPlanContent);
            for (const [path, content] of Object.entries(templateFiles)) {
              await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${path}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${githubToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: `Add ${path}`,
                  content: Buffer.from(content).toString('base64'),
                }),
              });
            }

            // Add LightBrands Studio files (before planning docs so they're the base layer)
            if (includeAiConfig) {
              const aiConfigFiles = await fetchAiCodingConfig(githubToken, progress);
              progress('Adding LightBrands Studio files...');

              let fileCount = 0;
              const totalFiles = Object.keys(aiConfigFiles).length;
              for (const [path, content] of Object.entries(aiConfigFiles)) {
                if (content.length < 100 && !content.includes('\n')) continue;

                await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${path}`, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: `Add ${path} from LightBrands Studio`,
                    content: Buffer.from(content).toString('base64'),
                  }),
                });

                fileCount++;
                if (fileCount % 10 === 0) {
                  progress(`Adding LightBrands Studio files... ${Math.round((fileCount / totalFiles) * 100)}%`);
                }
              }
            }

            // Add project plan file (final layer — deployed after studio files)
            if (projectPlanContent) {
              progress('Adding project plan...');
              await fetch(`https://api.github.com/repos/${repo.full_name}/contents/brand-details/project-plan.md`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${githubToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: 'Add project plan',
                  content: Buffer.from(projectPlanContent).toString('base64'),
                }),
              });
            }

            // Add brand identity file (final layer — deployed after studio files)
            if (brandIdentityContent) {
              progress('Adding brand identity...');
              await fetch(`https://api.github.com/repos/${repo.full_name}/contents/brand-details/brand-identity.md`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${githubToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: 'Add brand identity',
                  content: Buffer.from(brandIdentityContent).toString('base64'),
                }),
              });
            }

            stepComplete('github', { fullName: repo.full_name, htmlUrl: repo.html_url });
          } else {
            const err = await createRes.json();
            stepError('github', err.message || 'Failed to create repo');
          }
        } catch (e) {
          stepError('github', e instanceof Error ? e.message : 'Failed');
        }

        // Step 3: Get Supabase API keys
        if (supabaseProject && supabaseToken) {
          progress('Waiting for Supabase API keys...');
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const keysRes = await fetch(
              `https://api.supabase.com/v1/projects/${supabaseProject.ref}/api-keys`,
              { headers: { 'Authorization': `Bearer ${supabaseToken}` } }
            );
            if (keysRes.ok) {
              const keys = await keysRes.json();
              const anonKey = keys.find((k: { name: string }) => k.name === 'anon')?.api_key;
              if (anonKey) {
                supabaseProject.anonKey = anonKey;
                break;
              }
            }
          }
        }

        // Step 4: Create Vercel project
        if (includeVercel && vercelToken && githubRepo) {
          progress('Creating Vercel deployment...');
          try {
            const vercelApiUrl = vercelTeamId
              ? `https://api.vercel.com/v9/projects?teamId=${vercelTeamId}`
              : 'https://api.vercel.com/v9/projects';

            const createRes = await fetch(vercelApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name,
                framework: 'nextjs',
                gitRepository: { type: 'github', repo: githubRepo.fullName },
              }),
            });

            if (createRes.ok) {
              const project = await createRes.json();
              vercelProject = {
                id: project.id,
                name: project.name,
                url: `https://${project.name}.vercel.app`,
              };

              // Add env vars if Supabase exists
              if (supabaseProject) {
                const envBase = vercelTeamId
                  ? `https://api.vercel.com/v10/projects/${project.id}/env?teamId=${vercelTeamId}`
                  : `https://api.vercel.com/v10/projects/${project.id}/env`;

                const envVars = [
                  { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseProject.url },
                  ...(supabaseProject.anonKey ? [{ key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseProject.anonKey }] : []),
                ];

                for (const env of envVars) {
                  await fetch(envBase, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${vercelToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      key: env.key,
                      value: env.value,
                      type: 'encrypted',
                      target: ['production', 'preview', 'development'],
                    }),
                  });
                }
              }

              stepComplete('vercel', { id: project.id, name: project.name, url: vercelProject.url });
            } else {
              const err = await createRes.json();
              stepError('vercel', err.error?.message || 'Failed to create');
            }
          } catch (e) {
            stepError('vercel', e instanceof Error ? e.message : 'Failed');
          }
        }

        // Save integrations to database
        if (githubRepo && (vercelProject || supabaseProject)) {
          try {
            progress('Saving project integrations...');
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
            // Continue anyway - projects were created successfully
          }
        }

        // Done
        sendEvent(controller, 'complete', {
          success: true,
          summary: { github: githubRepo, supabase: supabaseProject, vercel: vercelProject },
        });
      } catch (error) {
        sendEvent(controller, 'error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getTemplateFiles(projectName: string, supabaseUrl?: string, projectPlanContent?: string | null): Record<string, string> {
  // Generate README from project plan or use default
  const readme = projectPlanContent
    ? projectPlanContent
    : `# ${projectName}

A Next.js project with Supabase integration.

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
`;

  return {
    'README.md': readme,
    'package.json': JSON.stringify({
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
      dependencies: {
        '@supabase/supabase-js': '^2.39.0',
        next: '14.0.4',
        react: '^18',
        'react-dom': '^18',
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        eslint: '^8',
        'eslint-config-next': '14.0.4',
        typescript: '^5',
      },
    }, null, 2),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),
    'next.config.js': '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {}\n\nmodule.exports = nextConfig',
    '.gitignore': `node_modules\n.next\n.env*.local\n.vercel\n*.tsbuildinfo\nnext-env.d.ts`,
    '.env.local.example': `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'your-url'}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-key`,
    'app/page.tsx': `export default function Home() {\n  return <main style={{padding:'2rem'}}><h1>${projectName}</h1><p>Ready to build!</p></main>\n}`,
    'app/layout.tsx': `export const metadata = { title: '${projectName}' }\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>\n}`,
  };
}
