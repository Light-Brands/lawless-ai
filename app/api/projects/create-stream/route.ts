import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const AI_CODING_CONFIG_REPO = 'TechNickAI/ai-coding-config';
// Only skip .git (internal git files) - everything else comes through
const SKIP_PREFIXES = ['.git/'];
const SKIP_FILES = ['LICENSE', 'implementation-plan.md'];

// Helper to send SSE messages
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
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
  const githubToken = request.cookies.get('github_token')?.value;
  const vercelToken = request.cookies.get('vercel_token')?.value;
  const supabaseToken = request.cookies.get('supabase_token')?.value;

  const body = await request.json();
  const {
    name,
    description,
    isPrivate = true,
    includeVercel = true,
    includeSupabase = true,
    supabaseRegion = 'us-east-1',
    githubOrg,
    vercelTeamId,
    supabaseOrgId,
  } = body;

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

            // Add template files
            progress('Adding template files...');
            const templateFiles = getTemplateFiles(name, supabaseProject?.url);
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

            // Add ai-coding-config files
            const aiConfigFiles = await fetchAiCodingConfig(githubToken, progress);
            progress('Adding ai-coding-config files...');

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
                  message: `Add ${path} from ai-coding-config`,
                  content: Buffer.from(content).toString('base64'),
                }),
              });

              fileCount++;
              if (fileCount % 10 === 0) {
                progress(`Adding ai-coding-config files... ${Math.round((fileCount / totalFiles) * 100)}%`);
              }
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

function getTemplateFiles(projectName: string, supabaseUrl?: string): Record<string, string> {
  return {
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
