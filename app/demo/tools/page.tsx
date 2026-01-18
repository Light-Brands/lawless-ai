'use client';

import { ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool, TaskTool } from '@/app/components/tools';

const sampleCode = `import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const response = await fetch(\`/api/users/\${userId}\`);
      const data = await response.json();
      setUser(data);
      setLoading(false);
    }
    fetchUser();
  }, [userId]);

  return { user, loading };
}`;

const sampleOldCode = `function greet(name) {
  console.log('Hello, ' + name);
}`;

const sampleNewCode = `function greet(name: string): void {
  console.log(\`Hello, \${name}!\`);
}`;

export default function ToolsDemoPage() {
  return (
    <div className="demo-page">
      <style jsx global>{`
        .demo-page {
          min-height: 100vh;
          padding: 2rem;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
        }
        .demo-header {
          max-width: 800px;
          margin: 0 auto 2rem;
        }
        .demo-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .demo-header p {
          color: var(--color-text-tertiary);
        }
        .demo-section {
          max-width: 800px;
          margin: 0 auto 3rem;
        }
        .demo-section h2 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          color: var(--color-text-secondary);
        }
        .demo-grid {
          display: grid;
          gap: 1.5rem;
        }
      `}</style>

      <header className="demo-header">
        <h1>Tool Card Components</h1>
        <p>Demo of the Claude Code CLI-style tool display components</p>
      </header>

      <section className="demo-section">
        <h2>Read Tool</h2>
        <div className="demo-grid">
          <ReadTool
            filePath="src/hooks/useUser.ts"
            content={sampleCode}
            status="success"
            lineCount={24}
          />
          <ReadTool
            filePath="src/config/database.ts"
            status="running"
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Write Tool</h2>
        <div className="demo-grid">
          <WriteTool
            filePath="src/utils/greet.ts"
            content={sampleNewCode}
            status="success"
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Edit Tool</h2>
        <div className="demo-grid">
          <EditTool
            filePath="src/utils/greet.ts"
            oldContent={sampleOldCode}
            newContent={sampleNewCode}
            status="success"
            description="Added TypeScript types"
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Bash Tool</h2>
        <div className="demo-grid">
          <BashTool
            command="npm run build"
            output={`> lawless-ai@1.0.0 build
> next build

   Creating an optimized production build...
   Compiled successfully
   Linting and checking validity of types...
   Collecting page data...
   Generating static pages (0/7)
   Generating static pages (7/7)

Route (app)                              Size     First Load JS
├ /                                      5.42 kB        89.1 kB
├ /repos                                 3.21 kB        86.9 kB
└ /workspace                             8.67 kB        92.3 kB

✓ Build completed in 12.4s`}
            status="success"
            description="Build the Next.js project"
          />
          <BashTool
            command="git status"
            status="running"
            description="Check git status"
          />
          <BashTool
            command="npm test"
            output={`FAIL  src/utils/greet.test.ts
  ● greet › should greet the user

    expect(received).toBe(expected)

    Expected: "Hello, World"
    Received: "Hello, World!"`}
            status="error"
            exitCode={1}
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Glob Tool</h2>
        <div className="demo-grid">
          <GlobTool
            pattern="**/*.tsx"
            path="src/components"
            files={[
              'src/components/Button.tsx',
              'src/components/Card.tsx',
              'src/components/Header.tsx',
              'src/components/Footer.tsx',
              'src/components/Modal.tsx',
            ]}
            status="success"
          />
          <GlobTool
            pattern="*.config.js"
            files={[]}
            status="success"
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Grep Tool</h2>
        <div className="demo-grid">
          <GrepTool
            pattern="useState"
            path="src"
            fileType="tsx"
            matches={[
              { file: 'src/hooks/useUser.ts', line: 1, content: "import { useState, useEffect } from 'react';" },
              { file: 'src/hooks/useUser.ts', line: 8, content: '  const [user, setUser] = useState<User | null>(null);' },
              { file: 'src/hooks/useUser.ts', line: 9, content: '  const [loading, setLoading] = useState(true);' },
              { file: 'src/components/Form.tsx', line: 3, content: "import { useState } from 'react';" },
              { file: 'src/components/Form.tsx', line: 12, content: '  const [value, setValue] = useState("");' },
            ]}
            status="success"
          />
        </div>
      </section>

      <section className="demo-section">
        <h2>Task Tool</h2>
        <div className="demo-grid">
          <TaskTool
            description="Find all API routes"
            agentType="Explore"
            status="running"
          />
          <TaskTool
            description="Run test suite"
            agentType="Bash"
            status="success"
            result="All 47 tests passed in 3.2s"
          />
        </div>
      </section>
    </div>
  );
}
