import { Router, Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { WORKSPACE_SYSTEM_PROMPT } from '../prompts/system';
import { WORKSPACE_DIR } from '../utils/workspace';

const router = Router();

// Demo chat endpoint for testing tools (no auth required, uses demo workspace)
router.post('/api/demo/chat', (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  // Use a demo workspace directory
  const demoWorkspacePath = path.join(WORKSPACE_DIR, '_demo');

  // Create demo workspace if it doesn't exist
  if (!fs.existsSync(demoWorkspacePath)) {
    fs.mkdirSync(demoWorkspacePath, { recursive: true });
    // Create some sample files for testing
    fs.writeFileSync(path.join(demoWorkspacePath, 'package.json'), JSON.stringify({
      name: "demo-project",
      version: "1.0.0",
      description: "Demo project for testing tools",
      scripts: {
        test: "echo 'Running tests...'",
        build: "echo 'Building project...'"
      },
      dependencies: {
        react: "^18.2.0",
        typescript: "^5.0.0"
      }
    }, null, 2));
    fs.writeFileSync(path.join(demoWorkspacePath, 'README.md'), '# Demo Project\n\nThis is a demo workspace for testing Claude tools.');
    // Create src directory and file properly
    const srcDir = path.join(demoWorkspacePath, 'src');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    fs.writeFileSync(path.join(srcDir, 'index.ts'), `export const hello = (name: string) => {
  console.log(\`Hello, \${name}!\`);
};

export const add = (a: number, b: number): number => {
  return a + b;
};
`);
    fs.writeFileSync(path.join(srcDir, 'utils.ts'), `export function formatDate(date: Date): string {
  return date.toISOString();
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
`);
  }

  const activeSessionId = uuidv4();

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  res.flushHeaders();

  // Spawn Claude CLI with access to the demo workspace
  const spawnEnv = {
    ...process.env,
    NO_COLOR: '1',
    HOME: process.env.HOME || '/home/ubuntu',
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin'
  };

  const claude: ChildProcessWithoutNullStreams = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--add-dir', demoWorkspacePath,
    '--dangerously-skip-permissions'
  ], {
    env: spawnEnv,
    cwd: demoWorkspacePath
  });

  // Write the system prompt and user's message
  const promptWithContext = `${WORKSPACE_SYSTEM_PROMPT}

You are working in a demo workspace with sample files. Use your tools to demonstrate their capabilities.

User request: ${message}`;
  claude.stdin.write(promptWithContext);
  claude.stdin.end();

  let responseContent = '';
  let buffer = '';
  const toolResults: Map<string, { tool: string; input: unknown }> = new Map();

  claude.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.type === 'assistant' && data.message?.content) {
          for (const content of data.message.content) {
            // Text content - with deduplication
            if (content.type === 'text' && content.text) {
              // Check if this is new content or accumulated content
              if (content.text.startsWith(responseContent) && responseContent.length > 0) {
                // This is accumulated content - only send the new part
                const newContent = content.text.slice(responseContent.length);
                if (newContent) {
                  responseContent = content.text;
                  res.write(`data: ${JSON.stringify({
                    type: 'text',
                    content: newContent,
                    sessionId: activeSessionId
                  })}\n\n`);
                }
              } else if (!responseContent.includes(content.text)) {
                // This is genuinely new content - append and send
                responseContent += content.text;
                res.write(`data: ${JSON.stringify({
                  type: 'text',
                  content: content.text,
                  sessionId: activeSessionId
                })}\n\n`);
              }
            }

            if (content.type === 'thinking' && content.thinking) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking',
                content: content.thinking,
                sessionId: activeSessionId
              })}\n\n`);
            }

            if (content.type === 'tool_use') {
              const toolId = content.id || `tool_${Date.now()}`;
              toolResults.set(toolId, { tool: content.name, input: content.input });

              res.write(`data: ${JSON.stringify({
                type: 'tool_use',
                id: toolId,
                tool: content.name,
                input: content.input,
                sessionId: activeSessionId
              })}\n\n`);
            }
          }
        }

        if (data.type === 'tool_result') {
          const toolId = data.tool_use_id || data.id;
          const toolInfo = toolResults.get(toolId);

          res.write(`data: ${JSON.stringify({
            type: 'tool_result',
            id: toolId,
            tool: toolInfo?.tool || 'unknown',
            output: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
            success: !data.is_error,
            sessionId: activeSessionId
          })}\n\n`);
        }

        if (data.type === 'error' || data.is_error) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: data.message || data.error || 'Unknown error',
            sessionId: activeSessionId
          })}\n\n`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  claude.stderr.on('data', (data: Buffer) => {
    console.error('Demo Claude stderr:', data.toString());
  });

  claude.on('close', () => {
    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: responseContent.trim(),
      sessionId: activeSessionId
    })}\n\n`);
    res.end();
  });

  claude.on('error', (err: Error) => {
    console.error('Failed to spawn Claude:', err);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Failed to start Claude CLI'
    })}\n\n`);
    res.end();
  });
});

export default router;
