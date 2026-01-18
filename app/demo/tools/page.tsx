'use client';

import { useState, useRef } from 'react';
import { ReadTool, WriteTool, EditTool, BashTool, GlobTool, GrepTool, TaskTool } from '@/app/components/tools';

// Types for streaming events
interface ToolUseEvent {
  type: 'tool_use';
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  tool: string;
  output: string;
  success: boolean;
}

interface TextEvent {
  type: 'text';
  content: string;
}

interface ThinkingEvent {
  type: 'thinking';
  content: string;
}

type StreamEvent = ToolUseEvent | ToolResultEvent | TextEvent | ThinkingEvent | { type: 'done' | 'error'; content?: string; message?: string };

interface ToolBlock {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'running' | 'success' | 'error';
}

interface MessageBlock {
  type: 'text' | 'thinking' | 'tool';
  content?: string;
  toolBlock?: ToolBlock;
}

// Suggested prompts for each tool type
const SUGGESTED_PROMPTS = [
  { label: 'Read', prompt: 'Read the package.json file', icon: '📖' },
  { label: 'Glob', prompt: 'Find all TypeScript files in the src directory', icon: '🔍' },
  { label: 'Grep', prompt: 'Search for "export" in all files', icon: '🔎' },
  { label: 'Bash', prompt: 'Run ls -la to list all files', icon: '💻' },
  { label: 'Write', prompt: 'Create a new file called hello.txt with "Hello, World!"', icon: '✏️' },
  { label: 'Edit', prompt: 'Add a new function called "multiply" to src/index.ts', icon: '📝' },
];

// Tool card renderer
function ToolCardRenderer({ block }: { block: ToolBlock }) {
  const { tool, input, status, output } = block;

  switch (tool) {
    case 'Read':
      return (
        <ReadTool
          filePath={(input.file_path as string) || 'unknown'}
          content={output}
          status={status}
          startLine={input.offset as number}
          endLine={input.limit as number}
        />
      );

    case 'Write':
      return (
        <WriteTool
          filePath={(input.file_path as string) || 'unknown'}
          content={(input.content as string) || output}
          status={status}
        />
      );

    case 'Edit':
      return (
        <EditTool
          filePath={(input.file_path as string) || 'unknown'}
          oldContent={(input.old_string as string) || ''}
          newContent={(input.new_string as string) || ''}
          status={status}
        />
      );

    case 'Bash':
      return (
        <BashTool
          command={(input.command as string) || ''}
          output={output}
          status={status}
          description={input.description as string}
        />
      );

    case 'Glob':
      return (
        <GlobTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          files={output ? output.split('\n').filter(Boolean) : []}
          status={status}
        />
      );

    case 'Grep': {
      const matches = output
        ? output.split('\n').filter(Boolean).map(line => {
            const match = line.match(/^(.+?):(\d+):(.*)$/);
            if (match) {
              return { file: match[1], line: parseInt(match[2]), content: match[3] };
            }
            return { file: 'unknown', line: 0, content: line };
          })
        : [];

      return (
        <GrepTool
          pattern={(input.pattern as string) || ''}
          path={input.path as string}
          fileType={input.type as string}
          matches={matches}
          status={status}
        />
      );
    }

    case 'Task':
      return (
        <TaskTool
          description={(input.description as string) || ''}
          agentType={input.subagent_type as string}
          status={status}
          result={output}
        />
      );

    default:
      return (
        <div className="tool-card generic">
          <div className="tool-card-header">
            <span className="tool-card-label">{tool}</span>
            <span className={`tool-card-status ${status}`}>{status}</span>
          </div>
          {output && (
            <div className="tool-card-body">
              <pre>{output}</pre>
            </div>
          )}
        </div>
      );
  }
}

// Interactive Tool Tester Component
function ToolTester() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<MessageBlock[]>([]);
  const [toolBlocks, setToolBlocks] = useState<Map<string, ToolBlock>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (customPrompt?: string) => {
    const messageToSend = customPrompt || prompt;
    if (!messageToSend.trim() || isLoading) return;

    // Reset state
    setIsLoading(true);
    setMessages([]);
    setToolBlocks(new Map());

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              handleStreamEvent(event);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Stream error:', error);
        setMessages(prev => [...prev, { type: 'text', content: `Error: ${(error as Error).message}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text':
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.type === 'text') {
            return [...prev.slice(0, -1), { type: 'text', content: (last.content || '') + event.content }];
          }
          return [...prev, { type: 'text', content: event.content }];
        });
        break;

      case 'thinking':
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.type === 'thinking') {
            return [...prev.slice(0, -1), { type: 'thinking', content: (last.content || '') + event.content }];
          }
          return [...prev, { type: 'thinking', content: event.content }];
        });
        break;

      case 'tool_use': {
        const toolBlock: ToolBlock = {
          id: event.id,
          tool: event.tool,
          input: event.input,
          status: 'running',
        };
        setToolBlocks(prev => new Map(prev).set(event.id, toolBlock));
        setMessages(prev => [...prev, { type: 'tool', toolBlock }]);
        break;
      }

      case 'tool_result': {
        setToolBlocks(prev => {
          const updated = new Map(prev);
          const existing = updated.get(event.id);
          if (existing) {
            updated.set(event.id, {
              ...existing,
              output: event.output,
              status: event.success ? 'success' : 'error',
            });
          }
          return updated;
        });
        break;
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  return (
    <div className="tool-tester">
      <div className="tester-input-area">
        <div className="tester-input-row">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Ask Claude to use a tool... (e.g., 'Read package.json')"
            disabled={isLoading}
          />
          {isLoading ? (
            <button onClick={handleCancel} className="cancel-btn">Cancel</button>
          ) : (
            <button onClick={() => handleSubmit()} disabled={!prompt.trim()}>Send</button>
          )}
        </div>
        <div className="suggested-prompts">
          <span className="suggested-label">Try:</span>
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setPrompt(item.prompt);
                handleSubmit(item.prompt);
              }}
              disabled={isLoading}
              className="suggested-btn"
              title={item.prompt}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="tester-results">
          {messages.map((block, index) => {
            if (block.type === 'text' && block.content) {
              return (
                <div key={index} className="result-text">
                  {block.content}
                </div>
              );
            }
            if (block.type === 'thinking' && block.content) {
              return (
                <div key={index} className="result-thinking">
                  <span className="thinking-icon">💭</span>
                  <span className="thinking-label">Thinking...</span>
                </div>
              );
            }
            if (block.type === 'tool' && block.toolBlock) {
              const currentBlock = toolBlocks.get(block.toolBlock.id) || block.toolBlock;
              return (
                <div key={index} className="result-tool">
                  <ToolCardRenderer block={currentBlock} />
                </div>
              );
            }
            return null;
          })}
          {isLoading && (
            <div className="loading-indicator">
              <div className="loading-spinner"></div>
              <span>Claude is working...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Static demo data
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
          max-width: 900px;
          margin: 0 auto 2rem;
        }
        .demo-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .demo-header p {
          color: var(--color-text-tertiary);
        }

        /* Tool Tester Styles */
        .tool-tester {
          max-width: 900px;
          margin: 0 auto 3rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .tester-input-area {
          margin-bottom: 1rem;
        }
        .tester-input-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .tester-input-row input {
          flex: 1;
          padding: 0.75rem 1rem;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-text-primary);
          font-size: 0.95rem;
        }
        .tester-input-row input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .tester-input-row input:disabled {
          opacity: 0.6;
        }
        .tester-input-row button {
          padding: 0.75rem 1.5rem;
          background: var(--color-accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .tester-input-row button:hover:not(:disabled) {
          opacity: 0.9;
        }
        .tester-input-row button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tester-input-row .cancel-btn {
          background: var(--color-text-tertiary);
        }

        .suggested-prompts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .suggested-label {
          color: var(--color-text-tertiary);
          font-size: 0.85rem;
          margin-right: 0.25rem;
        }
        .suggested-btn {
          padding: 0.4rem 0.75rem;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          color: var(--color-text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .suggested-btn:hover:not(:disabled) {
          border-color: var(--color-accent);
          color: var(--color-text-primary);
        }
        .suggested-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tester-results {
          border-top: 1px solid var(--color-border);
          padding-top: 1rem;
        }
        .result-text {
          padding: 1rem;
          background: var(--color-bg-primary);
          border-radius: 8px;
          margin-bottom: 1rem;
          white-space: pre-wrap;
          line-height: 1.6;
        }
        .result-thinking {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(147, 51, 234, 0.1);
          border: 1px solid rgba(147, 51, 234, 0.3);
          border-radius: 8px;
          margin-bottom: 1rem;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }
        .result-tool {
          margin-bottom: 1rem;
        }
        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          color: var(--color-text-tertiary);
        }
        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Demo sections */
        .demo-section {
          max-width: 900px;
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

        .section-divider {
          max-width: 900px;
          margin: 3rem auto;
          border: none;
          border-top: 1px solid var(--color-border);
        }
        .static-demos-header {
          max-width: 900px;
          margin: 0 auto 2rem;
        }
        .static-demos-header h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--color-text-secondary);
        }
        .static-demos-header p {
          color: var(--color-text-tertiary);
          font-size: 0.95rem;
        }
      `}</style>

      <header className="demo-header">
        <h1>Tool Card Components</h1>
        <p>Interactive demo of Claude Code CLI-style tool display components</p>
      </header>

      {/* Interactive Tester */}
      <section className="demo-section">
        <h2>Live Tool Tester</h2>
        <ToolTester />
      </section>

      <hr className="section-divider" />

      <div className="static-demos-header">
        <h2>Static Examples</h2>
        <p>Reference examples showing the different tool card states and styles</p>
      </div>

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
