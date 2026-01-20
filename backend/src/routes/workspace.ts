import { Router, Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';
import { WORKSPACE_SYSTEM_PROMPT } from '../prompts/system';
import { conversationService } from '../services/conversationService';
import { isSupabaseAvailable, Message } from '../lib/supabase';
import {
  WORKSPACE_DIR,
  getWorkspaceBasePath,
  getMainRepoPath,
  getWorktreesDir,
  getWorkspacePath,
  getWorkspaceSessionInfo,
  updateWorkspaceSessionAccess,
  isWorkspaceSessionWorktreeValid,
} from '../utils/workspace';

const router = Router();

// Setup workspace (clone or pull repo) with new directory structure
router.post('/api/workspace/setup', authenticateApiKey, async (req: Request, res: Response) => {
  const { repoFullName, githubToken } = req.body;

  if (!repoFullName || !githubToken) {
    res.status(400).json({ error: 'Repository name and GitHub token required' });
    return;
  }

  const basePath = getWorkspaceBasePath(repoFullName);
  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);

  try {
    // Check for old directory structure and migrate if needed
    const oldStructureExists = fs.existsSync(path.join(basePath, '.git')) && !fs.existsSync(mainRepoPath);

    if (oldStructureExists) {
      console.log(`Migrating old workspace structure for ${repoFullName}`);

      // Create a temp directory
      const tempPath = basePath + '_migration_temp';

      // Move existing repo to temp
      fs.renameSync(basePath, tempPath);

      // Create new structure
      fs.mkdirSync(basePath, { recursive: true });
      fs.mkdirSync(worktreesDir, { recursive: true });

      // Move temp (old repo) to main/
      fs.renameSync(tempPath, mainRepoPath);

      console.log(`Migration complete for ${repoFullName}`);
    }

    if (fs.existsSync(mainRepoPath)) {
      // Pull latest changes in main repo
      execSync(`git pull`, {
        cwd: mainRepoPath,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });
    } else {
      // Create base directory structure
      fs.mkdirSync(basePath, { recursive: true });
      fs.mkdirSync(worktreesDir, { recursive: true });

      // Clone the repo into main/
      const cloneUrl = `https://${githubToken}@github.com/${repoFullName}.git`;
      execSync(`git clone ${cloneUrl} "${mainRepoPath}"`, {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });
    }

    // Set git config for commits in main repo
    execSync(`git config user.email "lawless-ai@localhost"`, { cwd: mainRepoPath });
    execSync(`git config user.name "Lawless AI"`, { cwd: mainRepoPath });

    // Ensure worktrees directory exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    res.json({ success: true, workspacePath: mainRepoPath, worktreesDir });
  } catch (error: any) {
    console.error('Workspace setup error:', error);
    res.status(500).json({ error: `Failed to setup workspace: ${error.message}` });
  }
});

// Chat with Claude about code in workspace
// Persists to Supabase when userId is provided
router.post('/api/workspace/chat', authenticateApiKey, async (req: Request, res: Response) => {
  const { message, repoFullName, sessionId, workspaceSessionId, conversationHistory: clientHistory, userId } = req.body;

  if (!message || !repoFullName) {
    res.status(400).json({ error: 'Message and repository required' });
    return;
  }

  // If workspaceSessionId is provided, use the session's worktree path
  let workspacePath: string;
  if (workspaceSessionId) {
    const sessionInfo = getWorkspaceSessionInfo(workspaceSessionId);
    if (sessionInfo && isWorkspaceSessionWorktreeValid(workspaceSessionId)) {
      workspacePath = sessionInfo.worktree_path;
      updateWorkspaceSessionAccess(workspaceSessionId);
    } else {
      workspacePath = getWorkspacePath(repoFullName);
    }
  } else {
    workspacePath = getWorkspacePath(repoFullName);
  }

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found. Please setup first.' });
    return;
  }

  const activeSessionId = sessionId || uuidv4();

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  res.flushHeaders();

  // Spawn Claude CLI with access to the workspace
  const spawnEnv = {
    ...process.env,
    NO_COLOR: '1',
    HOME: '/home/ubuntu',
    PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
  };

  const claude: ChildProcessWithoutNullStreams = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--add-dir', workspacePath,
    '--dangerously-skip-permissions'
  ], {
    env: spawnEnv,
    cwd: workspacePath
  });

  // Track Supabase conversation for later saving
  let supabaseConversation = null;
  let supabaseConversationId: string | null = null;

  // Retrieve conversation history - try Supabase first, then SQLite, then client-provided
  let conversationHistory = '';
  if (workspaceSessionId) {
    // Try Supabase first if user is authenticated
    if (userId && isSupabaseAvailable()) {
      try {
        supabaseConversation = await conversationService.getOrCreateForWorkspace(
          userId,
          workspaceSessionId,
          repoFullName
        );
        if (supabaseConversation) {
          supabaseConversationId = supabaseConversation.id;
          const messages = supabaseConversation.messages as Array<{ role: string; content: string }>;
          if (messages && messages.length > 0) {
            conversationHistory = messages.map(msg => {
              const prefix = msg.role === 'user' ? 'User' : 'Assistant';
              return `${prefix}: ${msg.content}`;
            }).join('\n\n');
          }
        }
      } catch (e) {
        console.error('Failed to load Supabase conversation:', e);
      }
    }

    // Fall back to SQLite if no Supabase history
    if (!conversationHistory) {
      try {
        const existingConv = db.prepare(`
          SELECT messages FROM conversations WHERE workspace_session_id = ? LIMIT 1
        `).get(workspaceSessionId) as { messages: string } | undefined;

        if (existingConv) {
          const messages = JSON.parse(existingConv.messages) as Array<{ role: string; content: string }>;
          conversationHistory = messages.map(msg => {
            const prefix = msg.role === 'user' ? 'User' : 'Assistant';
            return `${prefix}: ${msg.content}`;
          }).join('\n\n');
        }
      } catch (e) {
        console.error('Failed to load SQLite conversation history:', e);
      }
    }
  }

  // Fall back to client-provided history (for local sessions without database records)
  if (!conversationHistory && clientHistory && Array.isArray(clientHistory)) {
    conversationHistory = clientHistory.map((msg: { role: string; content: string }) => {
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      return `${prefix}: ${msg.content}`;
    }).join('\n\n');
  }

  // Write the system prompt, conversation history, and user's message
  const promptWithContext = conversationHistory
    ? `${WORKSPACE_SYSTEM_PROMPT}

Previous conversation:
${conversationHistory}

User request: ${message}`
    : `${WORKSPACE_SYSTEM_PROMPT}

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

        // Handle assistant message with content blocks
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

            // Thinking/reasoning content
            if (content.type === 'thinking' && content.thinking) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking',
                content: content.thinking,
                sessionId: activeSessionId
              })}\n\n`);
            }

            // Tool use - Claude is calling a tool
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

        // Handle tool result
        if (data.type === 'content_block_delta' && data.delta?.type === 'tool_result') {
          const toolId = data.id || data.tool_use_id;
          const toolInfo = toolResults.get(toolId);

          res.write(`data: ${JSON.stringify({
            type: 'tool_result',
            id: toolId,
            tool: toolInfo?.tool || 'unknown',
            output: data.delta.content || '',
            success: !data.is_error,
            sessionId: activeSessionId
          })}\n\n`);
        }

        // Handle direct tool_result type
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

        // Handle final result
        if (data.type === 'result' && data.result && !responseContent) {
          responseContent = data.result;
          res.write(`data: ${JSON.stringify({
            type: 'text',
            content: data.result,
            sessionId: activeSessionId
          })}\n\n`);
        }

        // Handle error
        if (data.type === 'error' || data.is_error) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: data.message || data.error || 'Unknown error',
            sessionId: activeSessionId
          })}\n\n`);
        }
      } catch (e) {
        // Ignore parse errors for incomplete JSON
      }
    }
  });

  claude.stderr.on('data', (data: Buffer) => {
    console.error('Claude stderr:', data.toString());
  });

  claude.on('close', async (code: number | null) => {
    // Save messages if we have a workspace session
    if (workspaceSessionId && responseContent.trim()) {
      const newMessages: Message[] = [
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: responseContent.trim(), timestamp: new Date().toISOString() },
      ];

      // Save to Supabase if available
      if (supabaseConversationId && isSupabaseAvailable()) {
        try {
          await conversationService.appendMessages(supabaseConversationId, newMessages);

          // Update title if first message
          if (supabaseConversation && (!supabaseConversation.title || supabaseConversation.messages.length === 0)) {
            const title = conversationService.extractTitle(message);
            await conversationService.updateTitle(supabaseConversationId, title);
          }
        } catch (e) {
          console.error('Failed to save to Supabase:', e);
        }
      }

      // Also save to SQLite for backward compatibility
      try {
        const existingConv = db.prepare(`
          SELECT session_id, messages FROM conversations WHERE workspace_session_id = ? LIMIT 1
        `).get(workspaceSessionId) as { session_id: string; messages: string } | undefined;

        if (existingConv) {
          const messages = JSON.parse(existingConv.messages);
          messages.push({ role: 'user', content: message });
          messages.push({ role: 'assistant', content: responseContent.trim() });
          db.prepare(`
            UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?
          `).run(JSON.stringify(messages), existingConv.session_id);
        } else {
          const convId = uuidv4();
          const messages = [
            { role: 'user', content: message },
            { role: 'assistant', content: responseContent.trim() }
          ];
          db.prepare(`
            INSERT INTO conversations (session_id, messages, workspace_session_id)
            VALUES (?, ?, ?)
          `).run(convId, JSON.stringify(messages), workspaceSessionId);
        }
      } catch (e) {
        console.error('Failed to save workspace chat messages to SQLite:', e);
      }
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: responseContent.trim(),
      sessionId: activeSessionId,
      conversationId: supabaseConversationId
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
