import { NextRequest, NextResponse } from 'next/server';
import { getGitHubToken } from '@/lib/github/auth';

export const runtime = 'nodejs';

// Next.js + Supabase starter template files
const NEXTJS_SUPABASE_TEMPLATE = {
  'package.json': `{
  "name": "{{PROJECT_NAME}}",
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
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts`,
  '.env.local.example': `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`,
  'lib/supabase.ts': `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)`,
  'app/layout.tsx': `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{PROJECT_NAME}}',
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
  'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-rgb: 10, 10, 15;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}`,
  'app/page.tsx': `import { supabase } from '@/lib/supabase'

export default async function Home() {
  // Example: Test Supabase connection
  const { data, error } = await supabase.from('test').select('*').limit(1)

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{{PROJECT_NAME}}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Your Next.js + Supabase project is ready!
        </p>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Supabase Status</h2>
          <p className={error ? 'text-red-500' : 'text-green-500'}>
            {error ? \`Connection error: \${error.message}\` : 'Connected successfully!'}
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Next Steps</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
            <li>Create tables in your Supabase dashboard</li>
            <li>Update the Supabase query in this page</li>
            <li>Add authentication with Supabase Auth</li>
            <li>Deploy to Vercel</li>
          </ul>
        </div>
      </div>
    </main>
  )
}`,
  'README.md': `# {{PROJECT_NAME}}

A full-stack application built with Next.js and Supabase.

## Getting Started

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Copy \`.env.local.example\` to \`.env.local\` and fill in your Supabase credentials
4. Run the development server: \`npm run dev\`

## Tech Stack

- **Framework**: Next.js 14
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Language**: TypeScript

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
`,
};

export async function GET(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
  };

  try {
    // Fetch user's repositories (owned + collaborator access)
    const userReposPromise = fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
      { headers }
    );

    // Fetch user's organizations
    const orgsPromise = fetch('https://api.github.com/user/orgs?per_page=100', { headers });

    const [userReposResponse, orgsResponse] = await Promise.all([userReposPromise, orgsPromise]);

    if (!userReposResponse.ok) {
      if (userReposResponse.status === 401) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      throw new Error(`GitHub API error: ${userReposResponse.status}`);
    }

    const userRepos = await userReposResponse.json();
    const allRepos = [...userRepos];

    // Fetch repos from each organization
    if (orgsResponse.ok) {
      const orgs = await orgsResponse.json();

      // Fetch repos for each org in parallel
      const orgRepoPromises = orgs.map((org: { login: string }) =>
        fetch(`https://api.github.com/orgs/${org.login}/repos?per_page=100&sort=updated`, { headers })
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );

      const orgReposArrays = await Promise.all(orgRepoPromises);

      // Flatten and add org repos
      for (const orgRepos of orgReposArrays) {
        allRepos.push(...orgRepos);
      }
    }

    // Deduplicate by id (in case a repo appears in both user and org lists)
    const seenIds = new Set<number>();
    const uniqueRepos = allRepos.filter((repo: { id: number }) => {
      if (seenIds.has(repo.id)) return false;
      seenIds.add(repo.id);
      return true;
    });

    // Sort by updated date
    uniqueRepos.sort((a: { updated_at: string }, b: { updated_at: string }) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    // Return simplified repo data
    const simplifiedRepos = uniqueRepos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      cloneUrl: repo.clone_url,
      htmlUrl: repo.html_url,
    }));

    return NextResponse.json({ repos: simplifiedRepos });
  } catch (error) {
    console.error('Error fetching repos:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

// Create a new repository with optional template
export async function POST(request: NextRequest) {
  const token = await getGitHubToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, isPrivate, template, org } = body;

    if (!name) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 });
    }

    // Use different endpoint for org vs personal repos
    const apiUrl = org
      ? `https://api.github.com/orgs/${org}/repos`
      : 'https://api.github.com/user/repos';

    // Create the repository
    const createResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || `${name} - Built with Next.js and Supabase`,
        private: isPrivate ?? true,
        auto_init: false, // We'll add files manually
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return NextResponse.json(
        { error: error.message || 'Failed to create repository' },
        { status: createResponse.status }
      );
    }

    const repo = await createResponse.json();

    // If template requested, add template files
    if (template === 'nextjs-supabase') {
      // Get the owner's login for API calls
      const owner = repo.owner.login;
      const repoName = repo.name;

      // Create all template files
      for (const [filePath, content] of Object.entries(NEXTJS_SUPABASE_TEMPLATE)) {
        const fileContent = content.replace(/\{\{PROJECT_NAME\}\}/g, name);
        const encodedContent = Buffer.from(fileContent).toString('base64');

        await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add ${filePath}`,
            content: encodedContent,
          }),
        });
      }
    }

    return NextResponse.json({
      repo: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        description: repo.description,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch || 'main',
        owner: {
          login: repo.owner.login,
          avatarUrl: repo.owner.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('Error creating repo:', error);
    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
  }
}
