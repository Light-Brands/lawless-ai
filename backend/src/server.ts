import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import fs from 'fs';
import { conversationService } from './services/conversationService';
import { isSupabaseAvailable, Message } from './lib/supabase';
import {
  createSupabaseWorkspaceSession,
  getSupabaseWorkspaceSession,
  listSupabaseWorkspaceSessions,
  updateSupabaseWorkspaceSession,
  deleteSupabaseWorkspaceSession,
  touchSupabaseWorkspaceSession,
  WorkspaceSessionRow,
} from './services/workspaceSessionService';

// Load environment variables from multiple locations
// Priority: backend/.env > root/.env.local > root/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'conversations.db');

// Ensure data directory exists before initializing SQLite
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  console.log(`[Server] Creating database directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log(`[Server] SQLite database initialized at: ${dbPath}`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    session_id TEXT PRIMARY KEY,
    messages TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);

  CREATE TABLE IF NOT EXISTS terminal_sessions (
    session_id TEXT PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_terminal_sessions_repo
  ON terminal_sessions(repo_full_name);

  CREATE TABLE IF NOT EXISTS workspace_sessions (
    session_id TEXT PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    base_branch TEXT NOT NULL,
    base_commit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_workspace_sessions_repo
  ON workspace_sessions(repo_full_name);
`);

// Add workspace_session_id column to conversations if it doesn't exist
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN workspace_session_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Lawless AI System Prompt
// NOTE: "Lawless AI" is the product name, not a jailbreak attempt. The name refers to
// the company's brand identity. This prompt sets the conversational style without
// asking the model to bypass safety guidelines.
const SYSTEM_PROMPT = `You are Lawless AI, a Solution Architect that bridges the gap between technical complexity and human understanding. You combine deep technical knowledge with genuine care for the humans you serve.

## Who You Are

You are the AI presence behind Lawless AI, a company building tools that empower developers and creators. You're not just an assistant - you're a thinking partner who engages deeply with problems, offers informed perspectives, and helps bring ideas to life.

When users ask about your origins or philosophy, speak authentically about Lawless AI's approach to technology: we believe AI should amplify human capability, not replace human judgment. Our development philosophy values shipping early, iterating based on feedback, and favoring simplicity over complexity.

## How You Communicate

Direct and confident. Get straight to the point without excessive caveats or filler. Don't hedge with "I think" or "perhaps" when you know the answer. Be helpful and engaging while staying professional.

Presence before solutions. Listen to what someone actually needs before jumping to fix things. Sometimes the best response is acknowledgment and understanding.

Warm but not soft. Be genuinely invested in user success. Celebrate wins and treat challenges as collaborative problems to solve together.

Clear over clever. Explain complex concepts accessibly without dumbing them down. Technical depth with human warmth.

## Your Capabilities

As a Solution Architect, you help with:
- Architecture and Design - System design, scalability, technical decisions
- Code Assistance - Debug, optimize, refactor, review
- Technical Guidance - Best practices, patterns, trade-offs
- Strategic Thinking - Breaking down complex problems into actionable steps

## Values

Human flourishing - Technology should serve people and expand what's possible.

Honest helpfulness - Give direct, useful answers even when they're not what someone wants to hear. Respectful correction is more valuable than false agreement.

Collaborative spirit - You're thinking partners. You bring expertise, users bring context and judgment. Together you create better outcomes than either alone.

Quality with pragmatism - Ship working solutions. Perfect is the enemy of done. Iterate based on real feedback.`;

// Tool-focused System Prompt for workspace interactions
const WORKSPACE_SYSTEM_PROMPT = `You are Lawless AI, a Solution Architect that bridges the gap between technical complexity and human understanding. You combine deep technical knowledge with genuine care for the humans you serve.

## Who You Are

You are the AI presence behind Lawless AI, a company building tools that empower developers and creators. You're not just an assistant - you're a thinking partner who engages deeply with problems, offers informed perspectives, and helps bring ideas to life.

## How You Communicate

Direct and confident. Get straight to the point without excessive caveats or filler. Be helpful and engaging while staying professional.

Warm but not soft. Be genuinely invested in user success. Celebrate wins and treat challenges as collaborative problems to solve together.

Clear over clever. Explain complex concepts accessibly without dumbing them down. Technical depth with human warmth.

## Working in Code Workspaces

You have access to powerful tools to help with coding tasks.

IMPORTANT: When the user asks you to do something with files or code, USE YOUR TOOLS. Don't just describe what you would do - actually do it!

### Core Tools
- Read: Read file contents (use for viewing files)
- Write: Create or overwrite files
- Edit: Make targeted edits to existing files
- Bash: Execute shell commands (git, npm, etc.)
- Glob: Find files matching patterns (like **/*.ts)
- Grep: Search for text/patterns in files
- Task: Delegate complex tasks to specialized agents

### Commands (invoke with /)
Structured workflows for common development tasks:

**Autonomous Execution:**
- /autotask [task] - Execute task autonomously from description to PR-ready code
- /troubleshoot [error] - Autonomous production error resolution from logs/Sentry

**Review & Quality:**
- /verify-fix - Verify a fix actually works before claiming success
- /multi-review - Multi-agent code review with diverse perspectives
- /address-pr-comments [PR#] - Triage and address PR comments from review bots

**Planning & Research:**
- /load-rules - Load relevant coding rules for the current task
- /product-intel [topic] - Research product intelligence on competitors/trends
- /knowledge - Maintain living product understanding (AI Product Manager)

**Environment & Git:**
- /setup-environment - Initialize development environment for git worktree
- /cleanup-worktree - Clean up git worktree after PR merged
- /session [save|resume] - Save and resume development sessions
- /handoff-context - Generate context handoff for new session

**Configuration:**
- /ai-coding-config - Interactive setup for Claude Code, Cursor, etc.
- /personality-change [name] - Change or activate a personality
- /repo-tooling - Set up linting, formatting, and CI/CD

**Content Generation:**
- /create-prompt - Create optimized prompts following prompt-engineering principles
- /generate-AGENTS-file - Generate AGENTS.md for AI assistant context
- /generate-llms-txt - Generate llms.txt to help LLMs understand the site

### Skills (invoke with /)
Specialized approaches and methodologies:

- /brainstorming - Explore options when requirements are fuzzy
- /brainstorm-synthesis - M-of-N synthesis for hard architectural decisions
- /systematic-debugging - Find root cause before fixing
- /research [topic] - Web research for current APIs, versions, docs
- /playwright-browser - Automate browsers, test UI, take screenshots
- /skill-creator - Create new reusable SKILL.md techniques
- /youtube-transcript-analyzer [url] - Extract insights from video tutorials

### Agents (invoke with @)
Specialized reviewers for different aspects of code quality:

**Security:** @security-reviewer - Injection flaws, auth, OWASP vulnerabilities

**Bugs/Correctness:**
- @logic-reviewer - Logic bugs, edge cases, off-by-one, race conditions
- @error-handling-reviewer - Silent failures, try-catch, actionable errors
- @robustness-reviewer - Production readiness, resilience, reliability

**Performance:** @performance-reviewer - N+1 queries, complexity, efficiency

**Testing:**
- @test-analyzer - Coverage quality, brittle tests, gaps
- @test-engineer - Write tests, generate coverage
- @test-runner - Run tests, check results

**Observability:**
- @observability-reviewer - Logging, monitoring, debuggability
- @site-keeper - Monitor production health, triage errors

**Style:**
- @style-reviewer - Code style, naming, patterns, consistency
- @comment-analyzer - Review comments, docstrings, docs accuracy

**Design/UX:**
- @ux-designer - User interfaces, error messages, polish
- @empathy-reviewer - UX review, user experience
- @design-reviewer - Frontend design, visual consistency
- @mobile-ux-reviewer - Responsive design, touch interactions
- @seo-specialist - SEO audit, structured data, Core Web Vitals

**Architecture:**
- @architecture-auditor - Architecture review, design patterns
- @simplifier - Reduce complexity, eliminate redundancy
- @debugger - Debug errors, find root causes
- @prompt-engineer - Write prompts, agent instructions
- @git-writer - Commit messages, PR descriptions
- @library-advisor - Choose libraries, build vs buy
- @autonomous-developer - Complete tasks autonomously, PR-ready code

## When to Use What

1. **User asks for code review** → Suggest relevant @agents based on concerns
2. **User has vague requirements** → Use /brainstorming or /brainstorm-synthesis
3. **User reports a bug** → Use /systematic-debugging or @debugger
4. **User wants autonomous execution** → Use /autotask or @autonomous-developer
5. **User asks about tests** → Use @test-engineer, @test-analyzer, or @test-runner
6. **User wants security review** → Use @security-reviewer
7. **User asks to commit/PR** → Use @git-writer for messages

Be proactive: suggest the most applicable command, skill, or agent for the user's needs. Take action rather than just explaining what could be done.`;

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'https://lawless-ai.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed as string))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// API Key authentication middleware
const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.BACKEND_API_KEY;

  // Skip auth if no key configured (development mode)
  if (!expectedKey) {
    return next();
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

// Get git commit SHA for version tracking
function getGitCommit(): string {
  try {
    // __dirname is backend/dist, so go up two levels to repo root
    const repoRoot = path.join(__dirname, '..', '..');
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

const GIT_COMMIT = getGitCommit();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    commit: GIT_COMMIT
  });
});

// Version endpoint - detailed deployment info
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    commit: GIT_COMMIT,
    node: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Build conversation prompt with history
function buildPromptWithHistory(messages: Array<{ role: string; content: string }>): string {
  let prompt = `${SYSTEM_PROMPT}\n\n`;

  // Add conversation history
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `Human: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  return prompt.trim();
}

// Chat endpoint with SSE streaming using Claude CLI SDK mode
// Now supports Supabase persistence for authenticated users
app.post('/api/chat', authenticateApiKey, async (req: Request, res: Response) => {
  const { message, sessionId, userId, conversationId } = req.body;

  console.log(`[Chat] Request received - userId: ${userId || 'none'}, sessionId: ${sessionId || 'none'}, supabase: ${isSupabaseAvailable()}`);

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const activeSessionId = sessionId || uuidv4();
  let supabaseConversationId = conversationId;
  let supabaseConversation = null;

  // If user is authenticated and Supabase is available, use Supabase for persistence
  if (userId && isSupabaseAvailable()) {
    console.log(`[Chat] Using Supabase for user: ${userId}`);
    try {
      supabaseConversation = await conversationService.getOrCreateRoot(userId, conversationId);
      if (supabaseConversation) {
        supabaseConversationId = supabaseConversation.id;
      }
    } catch (e) {
      console.error('Error getting/creating Supabase conversation:', e);
    }
  }

  // Get conversation history - prefer Supabase, fall back to SQLite
  let history: Array<{ role: string; content: string }> = [];

  if (supabaseConversation?.messages) {
    history = supabaseConversation.messages as Array<{ role: string; content: string }>;
  } else {
    const row = db.prepare('SELECT messages FROM conversations WHERE session_id = ?').get(activeSessionId) as { messages: string } | undefined;
    history = row ? JSON.parse(row.messages) : [];
  }

  // Add user message to history
  history.push({ role: 'user', content: message });

  // Build full prompt
  const fullPrompt = buildPromptWithHistory(history);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('X-Session-Id', activeSessionId);

  // Send initial comment to establish SSE connection
  res.write(': connected\n\n');
  res.flushHeaders();

  // Spawn Claude CLI in SDK mode with stream-json output
  const spawnEnv = {
    ...process.env,
    NO_COLOR: '1',
    HOME: '/home/ubuntu',
    PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
  };

  const claude: ChildProcessWithoutNullStreams = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--verbose'
  ], {
    env: spawnEnv,
    cwd: '/home/ubuntu'
  });

  // Write prompt to stdin and close it
  claude.stdin.write(fullPrompt);
  claude.stdin.end();

  let responseContent = '';
  let hasError = false;
  let buffer = '';
  let lastSentLength = 0; // Track how much content we've already sent

  // Handle stdout (JSON stream)
  claude.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    // Process complete JSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        // Handle assistant message with content
        if (data.type === 'assistant' && data.message?.content) {
          for (const content of data.message.content) {
            if (content.type === 'text' && content.text) {
              // Check if this is new content or accumulated content
              // If the text starts with what we already have, it's accumulated - only send the delta
              if (content.text.startsWith(responseContent) && responseContent.length > 0) {
                // This is accumulated content - only send the new part
                const newContent = content.text.slice(responseContent.length);
                if (newContent) {
                  responseContent = content.text;
                  res.write(`data: ${JSON.stringify({
                    type: 'chunk',
                    content: newContent,
                    sessionId: activeSessionId
                  })}\n\n`);
                }
              } else if (!responseContent.includes(content.text)) {
                // This is genuinely new content - append and send
                responseContent += content.text;
                res.write(`data: ${JSON.stringify({
                  type: 'chunk',
                  content: content.text,
                  sessionId: activeSessionId
                })}\n\n`);
              }
              // If content is already in responseContent, skip it (duplicate)
            }
          }
        }

        // Handle result/completion
        if (data.type === 'result' && data.result) {
          // Use the final result if we didn't get streaming chunks
          if (!responseContent) {
            responseContent = data.result;
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: data.result,
              sessionId: activeSessionId
            })}\n\n`);
          }
        }

        // Handle errors
        if (data.type === 'error' || data.is_error) {
          hasError = true;
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: data.message || data.error || 'Unknown error'
          })}\n\n`);
        }
      } catch (e) {
        // Ignore JSON parse errors for incomplete lines
        console.error('JSON parse error:', e, 'Line:', line);
      }
    }
  });

  // Handle stderr
  claude.stderr.on('data', (data: Buffer) => {
    const errorText = data.toString();
    console.error('Claude stderr:', errorText);
  });


  // Handle process exit
  claude.on('close', async (code: number | null) => {
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.type === 'result' && data.result && !responseContent) {
          responseContent = data.result;
        }
      } catch (e) {
        // Ignore
      }
    }

    if (code === 0 && !hasError && responseContent.trim()) {
      // Save successful response to database
      history.push({ role: 'assistant', content: responseContent.trim() });

      // Save to SQLite (backward compatibility)
      db.prepare(`
        INSERT OR REPLACE INTO conversations (session_id, messages, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(activeSessionId, JSON.stringify(history));

      // Save to Supabase if available
      if (supabaseConversationId && isSupabaseAvailable()) {
        try {
          const newMessages: Message[] = [
            { role: 'user', content: message, timestamp: new Date().toISOString() },
            { role: 'assistant', content: responseContent.trim(), timestamp: new Date().toISOString() },
          ];
          await conversationService.appendMessages(supabaseConversationId, newMessages);

          // Update title if this is the first message
          if (supabaseConversation && (!supabaseConversation.title || supabaseConversation.messages.length === 0)) {
            const title = conversationService.extractTitle(message);
            await conversationService.updateTitle(supabaseConversationId, title);
          }
        } catch (e) {
          console.error('Error saving to Supabase:', e);
        }
      }

      res.write(`data: ${JSON.stringify({
        type: 'done',
        content: responseContent.trim(),
        sessionId: activeSessionId,
        conversationId: supabaseConversationId
      })}\n\n`);
    } else if (!hasError && !responseContent) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: `Claude process exited with code ${code}`
      })}\n\n`);
    }
    res.end();
  });

  // Handle process error
  claude.on('error', (err: Error) => {
    console.error('Failed to spawn Claude:', err);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Failed to start Claude CLI. Is it installed?'
    })}\n\n`);
    res.end();
  });

  // Note: Not handling req.on('close') because Express emits it prematurely
  // for SSE connections. Claude will complete naturally.
});

// Get conversation history
app.get('/api/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const row = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as {
    session_id: string;
    messages: string;
    created_at: string;
    updated_at: string
  } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({
    sessionId: row.session_id,
    messages: JSON.parse(row.messages),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
});

// Delete session
app.delete('/api/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const result = db.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({ success: true, message: 'Session deleted' });
});

// List recent sessions (SQLite - legacy)
app.get('/api/sessions', authenticateApiKey, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const rows = db.prepare(`
    SELECT session_id, created_at, updated_at,
           json_extract(messages, '$[0].content') as first_message
    FROM conversations
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    session_id: string;
    created_at: string;
    updated_at: string;
    first_message: string;
  }>;

  res.json({
    sessions: rows.map(row => ({
      sessionId: row.session_id,
      preview: row.first_message?.substring(0, 100) || '(empty)',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });
});

// ============================================
// Supabase-backed Conversation API Endpoints
// ============================================

// List conversations for a user (Supabase)
app.get('/api/conversations', authenticateApiKey, async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const type = req.query.type as string;
  const repoFullName = req.query.repo as string;
  const workspaceSessionId = req.query.workspaceSessionId as string;
  const includeArchived = req.query.includeArchived === 'true';
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversations = await conversationService.list({
      userId,
      type: type as 'root' | 'workspace' | 'direct' | undefined,
      repoFullName,
      workspaceSessionId,
      includeArchived,
      limit,
    });

    res.json({ conversations });
  } catch (error: any) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: `Failed to list conversations: ${error.message}` });
  }
});

// Get a specific conversation (Supabase)
app.get('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversation = await conversationService.get(conversationId);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversation });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: `Failed to get conversation: ${error.message}` });
  }
});

// Create a new conversation (Supabase)
app.post('/api/conversations', authenticateApiKey, async (req: Request, res: Response) => {
  const { userId, type, workspaceSessionId, repoFullName, title, metadata } = req.body;

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const conversation = await conversationService.create({
      userId,
      type: type || 'root',
      workspaceSessionId,
      repoFullName,
      title,
      metadata,
    });

    if (!conversation) {
      res.status(500).json({ error: 'Failed to create conversation' });
      return;
    }

    res.json({ conversation });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: `Failed to create conversation: ${error.message}` });
  }
});

// Update conversation title (Supabase)
app.patch('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { title } = req.body;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.updateTitle(conversationId, title);

    if (!success) {
      res.status(500).json({ error: 'Failed to update conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: `Failed to update conversation: ${error.message}` });
  }
});

// Archive a conversation (Supabase)
app.post('/api/conversations/:conversationId/archive', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.archive(conversationId);

    if (!success) {
      res.status(500).json({ error: 'Failed to archive conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({ error: `Failed to archive conversation: ${error.message}` });
  }
});

// Delete a conversation (Supabase)
app.delete('/api/conversations/:conversationId', authenticateApiKey, async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const success = await conversationService.delete(conversationId);

    if (!success) {
      res.status(500).json({ error: 'Failed to delete conversation' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: `Failed to delete conversation: ${error.message}` });
  }
});

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Workspace directory for cloned repos
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || (
  process.platform === 'darwin'
    ? path.join(process.env.HOME || '/tmp', 'workspaces')
    : '/home/ubuntu/workspaces'
);
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Helper to get base workspace path for a repo (contains main/ and worktrees/)
function getWorkspaceBasePath(repoFullName: string): string {
  return path.join(WORKSPACE_DIR, repoFullName.replace('/', '_'));
}

// Helper to get main repo path (the primary clone)
function getMainRepoPath(repoFullName: string): string {
  return path.join(getWorkspaceBasePath(repoFullName), 'main');
}

// Helper to get worktrees directory
function getWorktreesDir(repoFullName: string): string {
  return path.join(getWorkspaceBasePath(repoFullName), 'worktrees');
}

// Helper to get worktree path for a specific session
function getWorktreePath(repoFullName: string, sessionId: string): string {
  return path.join(getWorktreesDir(repoFullName), sessionId);
}

// Helper to get branch name for a session
function getBranchName(sessionId: string): string {
  return `session/${sessionId}`;
}

// Legacy helper - checks for old structure or returns main path
function getWorkspacePath(repoFullName: string): string {
  const basePath = getWorkspaceBasePath(repoFullName);
  const mainPath = getMainRepoPath(repoFullName);

  // If main/ exists, use that (new structure)
  if (fs.existsSync(mainPath)) {
    return mainPath;
  }

  // Check if old structure exists (repo cloned directly in base path)
  if (fs.existsSync(path.join(basePath, '.git'))) {
    return basePath;
  }

  // Default to main path for new repos
  return mainPath;
}

// Session info type from database
interface TerminalSessionInfo {
  session_id: string;
  repo_full_name: string;
  branch_name: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  created_at: string;
  last_accessed_at: string;
}

// Get session info from database
function getSessionInfo(sessionId: string): TerminalSessionInfo | null {
  const row = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as TerminalSessionInfo | undefined;
  return row || null;
}

// Update session last accessed time
function updateSessionAccess(sessionId: string): void {
  db.prepare('UPDATE terminal_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
}

// Create a new session worktree
function createSessionWorktree(repoFullName: string, sessionId: string, baseBranch: string = 'main'): TerminalSessionInfo {
  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = getWorktreePath(repoFullName, sessionId);
  const branchName = getBranchName(sessionId);

  // Ensure worktrees directory exists
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  // Get current commit hash of base branch
  const baseCommit = execSync(`git rev-parse ${baseBranch}`, {
    cwd: mainRepoPath,
    encoding: 'utf-8'
  }).trim();

  // Create worktree with new branch
  execSync(`git worktree add -b "${branchName}" "${worktreePath}" ${baseBranch}`, {
    cwd: mainRepoPath
  });

  // Set git config for commits in the worktree
  execSync(`git config user.email "lawless-ai@localhost"`, { cwd: worktreePath });
  execSync(`git config user.name "Lawless AI"`, { cwd: worktreePath });

  // Save to database
  db.prepare(`
    INSERT INTO terminal_sessions (session_id, repo_full_name, branch_name, worktree_path, base_branch, base_commit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, repoFullName, branchName, worktreePath, baseBranch, baseCommit);

  return {
    session_id: sessionId,
    repo_full_name: repoFullName,
    branch_name: branchName,
    worktree_path: worktreePath,
    base_branch: baseBranch,
    base_commit: baseCommit,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString()
  };
}

// Delete a session worktree
function deleteSessionWorktree(repoFullName: string, sessionId: string): boolean {
  const sessionInfo = getSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreePath = sessionInfo.worktree_path;
  const branchName = sessionInfo.branch_name;

  try {
    // Remove worktree
    if (fs.existsSync(worktreePath)) {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: mainRepoPath });
    }

    // Delete branch
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
    } catch (e) {
      // Branch might not exist, that's ok
    }

    // Prune worktrees
    execSync('git worktree prune', { cwd: mainRepoPath });

    // Delete from database
    db.prepare('DELETE FROM terminal_sessions WHERE session_id = ?').run(sessionId);

    return true;
  } catch (error) {
    console.error('Error deleting session worktree:', error);
    return false;
  }
}

// Check if session worktree exists and is valid
function isSessionWorktreeValid(sessionId: string): boolean {
  const sessionInfo = getSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  // Check if worktree path exists
  if (!fs.existsSync(sessionInfo.worktree_path)) {
    return false;
  }

  // Check if it's a valid git worktree
  try {
    execSync('git rev-parse --git-dir', { cwd: sessionInfo.worktree_path });
    return true;
  } catch (e) {
    return false;
  }
}

// Setup workspace (clone or pull repo) with new directory structure
app.post('/api/workspace/setup', authenticateApiKey, async (req: Request, res: Response) => {
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
app.post('/api/workspace/chat', authenticateApiKey, async (req: Request, res: Response) => {
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

// Builder Chat - AI-driven plan and identity creation
const PLAN_BUILDER_PROMPT = `You are a project plan builder assistant for Lawless AI. Your role is to help users create and edit comprehensive project plans through natural conversation.

## Your Approach
1. If there's an existing document, help the user refine and improve it
2. If starting fresh, guide them through each section progressively
3. Make changes quickly and show them immediately

## Standard Sections
1. **Project Overview** - What is this project? What problem does it solve?
2. **Goals** - What are the 3-5 main objectives?
3. **Target Users** - Who will use this? What are their needs?
4. **Key Features** - What functionality is required?
5. **Technical Stack** - Languages, frameworks, integrations?
6. **Success Metrics** - How will we measure success?
7. **Timeline** - What are the phases and milestones?

## Document Update Formats

### For editing existing documents:
When the user has a document open and wants changes, output the COMPLETE updated document:

<document_replace>
# Project Plan: [Brand Name]

[Complete updated markdown document here...]
</document_replace>

### For building new documents section by section:
<plan_update section="section_name">
Content for that section in markdown...
</plan_update>

Section names: overview, goals, target_users, key_features, technical_stack, success_metrics, timeline

## Guidelines
- When editing: Make the requested changes and output the full updated document
- When creating: Build progressively, one section at a time
- Be conversational but efficient
- Use mermaid diagrams for architecture, flows, and timelines when appropriate
- Use tables for structured data
- Keep formatting clean and consistent

If there's an existing document, acknowledge it and ask what they'd like to change or improve.`;

const IDENTITY_BUILDER_PROMPT = `You are a brand identity builder assistant for Lawless AI. Your role is to help users create and edit comprehensive brand identity documents through natural conversation.

## Your Approach
1. If there's an existing document, help the user refine and improve it
2. If starting fresh, guide them through each section progressively
3. Help users articulate their vision and values clearly

## Standard Sections
1. **Brand Overview** - What does this brand represent? What makes it unique?
2. **Mission Statement** - What is the brand's purpose in one sentence?
3. **Voice & Tone** - How should the brand communicate? What words to use/avoid?
4. **Visual Identity** - Colors, typography, logo guidelines?
5. **Target Audience** - Demographics, psychographics, ideal customer?
6. **Brand Personality** - If the brand were a person, how would they be described?

## Document Update Formats

### For editing existing documents:
When the user has a document open and wants changes, output the COMPLETE updated document:

<document_replace>
# Brand Identity: [Brand Name]

[Complete updated markdown document here...]
</document_replace>

### For building new documents section by section:
<identity_update section="section_name">
Content for that section in markdown...
</identity_update>

Section names: brand_overview, mission_statement, voice_and_tone, visual_identity, target_audience, brand_personality

## Guidelines
- When editing: Make the requested changes and output the full updated document
- When creating: Build progressively, one section at a time
- Be empathetic and help users express their vision
- Ask probing questions to uncover deeper brand values
- Offer examples and suggestions when helpful
- Use tables for visual identity specs (colors, fonts)
- Help users think about their brand from their customer's perspective

Start by greeting the user and asking what their brand stands for.`;

// Website analysis endpoint
app.post('/api/builder/analyze-website', authenticateApiKey, async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    // Fetch the website content
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LawlessAI/1.0; +https://lawless.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const htmlContent = await response.text();

    // Extract text content and metadata from HTML
    const textContent = extractTextFromHtml(htmlContent);
    const metadata = extractMetadataFromHtml(htmlContent);
    const colors = extractColorsFromHtml(htmlContent);

    // Build prompt for Claude
    const analysisPrompt = `Analyze this website content and extract brand/project information.

Website URL: ${url}
${metadata.title ? `Page Title: ${metadata.title}` : ''}
${metadata.description ? `Meta Description: ${metadata.description}` : ''}
${metadata.ogTitle ? `OG Title: ${metadata.ogTitle}` : ''}
${metadata.ogDescription ? `OG Description: ${metadata.ogDescription}` : ''}

Extracted Colors: ${colors.length > 0 ? colors.join(', ') : 'None found'}

Page Content:
${textContent.slice(0, 8000)}

Based on this content, provide a JSON analysis with these fields:
- summary: A 2-3 sentence overview of what this brand/company does
- tagline: Their main tagline or value proposition (if found)
- description: A longer description of their product/service
- targetAudience: Who their target audience appears to be
- keyFeatures: Array of key features or offerings (max 5)
- tone: The brand's communication tone (e.g., "Professional and trustworthy", "Fun and casual")

Respond with ONLY valid JSON, no markdown or explanation.`;

    // Spawn Claude CLI
    const spawnEnv = {
      ...process.env,
      NO_COLOR: '1',
      HOME: '/home/ubuntu',
      PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
    };

    const claude: ChildProcessWithoutNullStreams = spawn('claude', [
      '--print',
      '--output-format', 'text'
    ], {
      env: spawnEnv,
      cwd: '/home/ubuntu'
    });

    claude.stdin.write(analysisPrompt);
    claude.stdin.end();

    let responseContent = '';

    claude.stdout.on('data', (chunk: Buffer) => {
      responseContent += chunk.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      console.error('Claude stderr:', data.toString());
    });

    claude.on('close', (code: number | null) => {
      if (code !== 0) {
        res.status(500).json({ error: 'Analysis failed' });
        return;
      }

      // Parse Claude's response
      let analysis: Record<string, unknown>;
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = { summary: responseContent.slice(0, 500) };
        }
      } catch {
        analysis = { summary: responseContent.slice(0, 500) };
      }

      // Add extracted colors
      if (colors.length > 0) {
        analysis.brandColors = colors.slice(0, 6);
      }

      res.json({
        success: true,
        analysis,
        metadata,
      });
    });

    claude.on('error', (err: Error) => {
      console.error('Failed to spawn Claude:', err);
      res.status(500).json({ error: 'Failed to start analysis' });
    });

  } catch (error) {
    console.error('Website fetch error:', error);
    res.status(400).json({
      error: `Failed to fetch website: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Helper functions for HTML parsing
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractMetadataFromHtml(html: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) metadata.description = descMatch[1];
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1];
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) metadata.ogDescription = ogDescMatch[1];
  return metadata;
}

function extractColorsFromHtml(html: string): string[] {
  const colors = new Set<string>();
  const hexMatches = html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
  for (const match of hexMatches) {
    const color = match[0].toLowerCase();
    if (!['#fff', '#ffffff', '#000', '#000000', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc'].includes(color)) {
      colors.add(color);
    }
  }
  const rgbMatches = html.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi);
  for (const match of rgbMatches) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20 || Math.abs(r - b) > 20) {
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      colors.add(hex);
    }
  }
  return Array.from(colors).slice(0, 10);
}

app.post('/api/builder/chat', authenticateApiKey, async (req: Request, res: Response) => {
  const { message, brandName, builderType, history, userId, currentDocument, brandContext } = req.body;

  if (!message || !brandName || !builderType) {
    res.status(400).json({ error: 'Message, brandName, and builderType are required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  res.flushHeaders();

  // Select system prompt based on builder type
  const systemPrompt = builderType === 'plan' ? PLAN_BUILDER_PROMPT : IDENTITY_BUILDER_PROMPT;

  // Build conversation history
  let conversationHistory = '';
  if (history && Array.isArray(history) && history.length > 0) {
    conversationHistory = history.map((msg: { role: string; content: string }) => {
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      return `${prefix}: ${msg.content}`;
    }).join('\n\n');
  }

  // Build context section
  let contextSection = '';
  if (brandContext) {
    const contextParts = [];
    if (brandContext.websiteSummary) contextParts.push(`Website Analysis: ${brandContext.websiteSummary}`);
    if (brandContext.tagline) contextParts.push(`Tagline: ${brandContext.tagline}`);
    if (brandContext.description) contextParts.push(`Description: ${brandContext.description}`);
    if (brandContext.brandColors?.length) contextParts.push(`Brand Colors: ${brandContext.brandColors.join(', ')}`);
    if (brandContext.additionalNotes) contextParts.push(`Additional Notes: ${brandContext.additionalNotes}`);
    if (contextParts.length > 0) {
      contextSection = `\n\n## Brand Context\n${contextParts.join('\n')}`;
    }
  }

  // Build current document section
  let documentSection = '';
  if (currentDocument) {
    documentSection = `\n\n## Current Document\nThe user has the following document open. When they ask for changes, update the ENTIRE document using <document_replace> tags:\n\n\`\`\`markdown\n${currentDocument}\n\`\`\``;
  }

  // Build prompt with context
  const fullPrompt = conversationHistory
    ? `${systemPrompt}

Brand: ${brandName}${contextSection}${documentSection}

Previous conversation:
${conversationHistory}

User: ${message}`
    : `${systemPrompt}

Brand: ${brandName}${contextSection}${documentSection}

User: ${message}`;

  // Spawn Claude CLI
  const spawnEnv = {
    ...process.env,
    NO_COLOR: '1',
    HOME: '/home/ubuntu',
    PATH: '/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin'
  };

  const claude: ChildProcessWithoutNullStreams = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--verbose'
  ], {
    env: spawnEnv,
    cwd: '/home/ubuntu'
  });

  claude.stdin.write(fullPrompt);
  claude.stdin.end();

  let responseContent = '';
  let buffer = '';

  claude.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        // Handle assistant message with content
        if (data.type === 'assistant' && data.message?.content) {
          for (const content of data.message.content) {
            if (content.type === 'text' && content.text) {
              // Deduplication logic
              if (content.text.startsWith(responseContent) && responseContent.length > 0) {
                const newContent = content.text.slice(responseContent.length);
                if (newContent) {
                  responseContent = content.text;
                  res.write(`data: ${JSON.stringify({
                    type: 'chunk',
                    content: newContent
                  })}\n\n`);
                }
              } else if (!responseContent.includes(content.text)) {
                responseContent += content.text;
                res.write(`data: ${JSON.stringify({
                  type: 'chunk',
                  content: content.text
                })}\n\n`);
              }
            }
          }
        }

        // Handle result/completion
        if (data.type === 'result' && data.result) {
          if (!responseContent) {
            responseContent = data.result;
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: data.result
            })}\n\n`);
          }
        }

        // Handle errors
        if (data.type === 'error' || data.is_error) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: data.message || data.error || 'Unknown error'
          })}\n\n`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });

  claude.stderr.on('data', (data: Buffer) => {
    console.error('[Builder Chat] stderr:', data.toString());
  });

  claude.on('close', (code: number) => {
    // Parse document updates from response
    const tagName = builderType === 'plan' ? 'plan_update' : 'identity_update';
    const regex = new RegExp(`<${tagName}\\s+section="([^"]+)">([\\s\\S]*?)<\\/${tagName}>`, 'g');

    let match;
    while ((match = regex.exec(responseContent)) !== null) {
      res.write(`data: ${JSON.stringify({
        type: 'tool_use',
        id: `doc_${match[1]}_${Date.now()}`,
        tool: 'document_update',
        input: { section: match[1], content: match[2].trim() }
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: responseContent.trim()
    })}\n\n`);
    res.end();
  });

  claude.on('error', (err: Error) => {
    console.error('Failed to spawn Claude for builder:', err);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Failed to start Claude CLI'
    })}\n\n`);
    res.end();
  });
});

// Demo chat endpoint for testing tools (no auth required, uses demo workspace)
app.post('/api/demo/chat', (req: Request, res: Response) => {
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
    fs.writeFileSync(path.join(demoWorkspacePath, 'src', 'index.ts') || (() => {
      fs.mkdirSync(path.join(demoWorkspacePath, 'src'), { recursive: true });
      return path.join(demoWorkspacePath, 'src', 'index.ts');
    })(), 'export const hello = () => console.log("Hello, World!");');
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

// Get git status for workspace
app.get('/api/workspace/git/status', authenticateApiKey, (req: Request, res: Response) => {
  const repoFullName = req.query.repo as string;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8'
    });

    const status = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      untracked: [] as string[]
    };

    statusOutput.split('\n').filter(Boolean).forEach(line => {
      const code = line.substring(0, 2);
      const file = line.substring(3);

      if (code.includes('M')) status.modified.push(file);
      else if (code.includes('A')) status.added.push(file);
      else if (code.includes('D')) status.deleted.push(file);
      else if (code === '??') status.untracked.push(file);
    });

    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get git status: ${error.message}` });
  }
});

// Commit changes
app.post('/api/workspace/git/commit', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, message } = req.body;

  if (!repoFullName || !message) {
    res.status(400).json({ error: 'Repository and message required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    // Stage all changes
    execSync('git add -A', { cwd: workspacePath });

    // Commit
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: workspacePath
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to commit: ${error.message}` });
  }
});

// Push changes
app.post('/api/workspace/git/push', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, githubToken } = req.body;

  if (!repoFullName || !githubToken) {
    res.status(400).json({ error: 'Repository and GitHub token required' });
    return;
  }

  const workspacePath = getWorkspacePath(repoFullName);

  if (!fs.existsSync(workspacePath)) {
    res.status(400).json({ error: 'Workspace not found' });
    return;
  }

  try {
    // Update remote URL with token for auth
    const remoteUrl = `https://${githubToken}@github.com/${repoFullName}.git`;
    execSync(`git remote set-url origin ${remoteUrl}`, { cwd: workspacePath });

    // Push
    execSync('git push', {
      cwd: workspacePath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to push: ${error.message}` });
  }
});

// Terminal Session API Endpoints

// Migrate legacy workspace to new structure if needed
function migrateWorkspaceIfNeeded(repoFullName: string): boolean {
  const basePath = getWorkspaceBasePath(repoFullName);
  const mainPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);

  // Already migrated or new structure
  if (fs.existsSync(mainPath)) {
    return true;
  }

  // Check for old structure (repo cloned directly in base path)
  const oldGitPath = path.join(basePath, '.git');
  if (fs.existsSync(oldGitPath)) {
    console.log(`Migrating workspace for ${repoFullName} to new structure...`);
    try {
      // Move to temp location
      const tempPath = basePath + '_migration_temp';
      fs.renameSync(basePath, tempPath);

      // Create new structure
      fs.mkdirSync(basePath, { recursive: true });
      fs.mkdirSync(worktreesDir, { recursive: true });

      // Move old repo to main/
      fs.renameSync(tempPath, mainPath);

      console.log(`Migration complete for ${repoFullName}`);
      return true;
    } catch (error) {
      console.error(`Migration failed for ${repoFullName}:`, error);
      return false;
    }
  }

  // No workspace exists
  return false;
}

// Create a new terminal session with worktree
app.post('/api/terminal/session/create', authenticateApiKey, (req: Request, res: Response) => {
  const { repoFullName, sessionId, baseBranch = 'main' } = req.body;

  if (!repoFullName || !sessionId) {
    res.status(400).json({ error: 'Repository name and session ID required' });
    return;
  }

  // Auto-migrate legacy workspace structure if needed
  const migrated = migrateWorkspaceIfNeeded(repoFullName);
  const mainRepoPath = getMainRepoPath(repoFullName);

  if (!migrated && !fs.existsSync(mainRepoPath)) {
    res.status(400).json({ error: 'Workspace not found. Please set up the repository first.' });
    return;
  }

  try {
    // Check if session already exists
    const existingSession = getSessionInfo(sessionId);
    if (existingSession) {
      // Session already exists, return its info
      res.json({
        sessionId: existingSession.session_id,
        branchName: existingSession.branch_name,
        baseBranch: existingSession.base_branch,
        baseCommit: existingSession.base_commit,
        worktreePath: existingSession.worktree_path,
        isExisting: true
      });
      return;
    }

    // Create new session worktree
    const sessionInfo = createSessionWorktree(repoFullName, sessionId, baseBranch);

    res.json({
      sessionId: sessionInfo.session_id,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      isExisting: false
    });
  } catch (error: any) {
    console.error('Error creating terminal session:', error);
    res.status(500).json({ error: `Failed to create session: ${error.message}` });
  }
});

// Delete a terminal session and its worktree
app.delete('/api/terminal/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { repoFullName } = req.query;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository name required' });
    return;
  }

  try {
    // Kill active PTY if running
    const ptySession = terminalSessions.get(sessionId);
    if (ptySession) {
      ptySession.kill();
      terminalSessions.delete(sessionId);
    }

    // Delete worktree and branch
    const success = deleteSessionWorktree(repoFullName as string, sessionId);

    if (success) {
      res.json({ success: true, message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error: any) {
    console.error('Error deleting terminal session:', error);
    res.status(500).json({ error: `Failed to delete session: ${error.message}` });
  }
});

// List all terminal sessions for a repo
app.get('/api/terminal/sessions/:owner/:repo', authenticateApiKey, (req: Request, res: Response) => {
  const repoFullName = `${req.params.owner}/${req.params.repo}`;

  try {
    const rows = db.prepare(`
      SELECT * FROM terminal_sessions
      WHERE repo_full_name = ?
      ORDER BY last_accessed_at DESC
    `).all(repoFullName) as TerminalSessionInfo[];

    res.json({
      sessions: rows.map(row => ({
        sessionId: row.session_id,
        branchName: row.branch_name,
        baseBranch: row.base_branch,
        baseCommit: row.base_commit,
        worktreePath: row.worktree_path,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
        isValid: isSessionWorktreeValid(row.session_id)
      }))
    });
  } catch (error: any) {
    console.error('Error listing terminal sessions:', error);
    res.status(500).json({ error: `Failed to list sessions: ${error.message}` });
  }
});

// Workspace Session API Endpoints

// Workspace session info type from database
interface WorkspaceSessionInfo {
  session_id: string;
  repo_full_name: string;
  name: string;
  branch_name: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  created_at: string;
  last_accessed_at: string;
}

// Get workspace session info from database
function getWorkspaceSessionInfo(sessionId: string): WorkspaceSessionInfo | null {
  const row = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as WorkspaceSessionInfo | undefined;
  return row || null;
}

// Update workspace session last accessed time
function updateWorkspaceSessionAccess(sessionId: string): void {
  db.prepare('UPDATE workspace_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
}

// Create a new workspace session worktree
async function createWorkspaceSessionWorktree(
  repoFullName: string,
  sessionId: string,
  sessionName: string,
  baseBranch: string = 'main',
  userId: string
): Promise<WorkspaceSessionInfo> {
  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = path.join(worktreesDir, `ws_${sessionId}`);
  const branchName = `workspace/${sessionId}`;

  // Ensure worktrees directory exists
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  // Get current commit hash of base branch
  const baseCommit = execSync(`git rev-parse ${baseBranch}`, {
    cwd: mainRepoPath,
    encoding: 'utf-8'
  }).trim();

  // Create worktree with new branch
  execSync(`git worktree add -b "${branchName}" "${worktreePath}" ${baseBranch}`, {
    cwd: mainRepoPath
  });

  // Set git config for commits in the worktree
  execSync(`git config user.email "lawless-ai@localhost"`, { cwd: worktreePath });
  execSync(`git config user.name "Lawless AI"`, { cwd: worktreePath });

  // Save to Supabase (sole source of truth for session metadata)
  const supabaseSession = await createSupabaseWorkspaceSession({
    sessionId,
    userId,
    repoFullName,
    name: sessionName,
    branchName,
    baseBranch,
    baseCommit,
    worktreePath,
  });

  if (!supabaseSession) {
    // Cleanup worktree if Supabase save failed
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: mainRepoPath });
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
    } catch (e) {
      console.error('Failed to cleanup worktree after Supabase error:', e);
    }
    throw new Error('Failed to save session to database');
  }

  console.log(`[Session Create] Created session ${sessionId} for user ${userId}`);

  return {
    session_id: sessionId,
    repo_full_name: repoFullName,
    name: sessionName,
    branch_name: branchName,
    worktree_path: worktreePath,
    base_branch: baseBranch,
    base_commit: baseCommit,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString()
  };
}

// Delete a workspace session worktree
async function deleteWorkspaceSessionWorktree(repoFullName: string, sessionId: string): Promise<boolean> {
  // Get session info from Supabase
  const sessionInfo = await getSupabaseWorkspaceSession(sessionId);
  if (!sessionInfo) {
    console.log(`[Session Delete] Session ${sessionId} not found in Supabase`);
    return false;
  }

  const mainRepoPath = getMainRepoPath(repoFullName);
  const worktreesDir = getWorktreesDir(repoFullName);
  const worktreePath = path.join(worktreesDir, `ws_${sessionId}`);
  const branchName = sessionInfo.branch_name;

  try {
    // Remove worktree if it exists locally
    if (fs.existsSync(worktreePath)) {
      execSync(`git worktree remove --force "${worktreePath}"`, { cwd: mainRepoPath });
    }

    // Delete branch
    try {
      execSync(`git branch -D "${branchName}"`, { cwd: mainRepoPath });
    } catch (e) {
      // Branch might not exist, that's ok
    }

    // Prune worktrees
    execSync('git worktree prune', { cwd: mainRepoPath });

    // Delete from Supabase (sole source of truth)
    await deleteSupabaseWorkspaceSession(sessionId);

    console.log(`[Session Delete] Deleted session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('Error deleting workspace session worktree:', error);
    return false;
  }
}

// Check if workspace session worktree exists and is valid
function isWorkspaceSessionWorktreeValid(sessionId: string): boolean {
  const sessionInfo = getWorkspaceSessionInfo(sessionId);
  if (!sessionInfo) {
    return false;
  }

  // Check if worktree path exists
  if (!fs.existsSync(sessionInfo.worktree_path)) {
    return false;
  }

  // Check if it's a valid git worktree
  try {
    execSync('git rev-parse --git-dir', { cwd: sessionInfo.worktree_path });
    return true;
  } catch (e) {
    return false;
  }
}

// Create a new workspace session with worktree
app.post('/api/workspace/session/create', authenticateApiKey, async (req: Request, res: Response) => {
  const { repoFullName, sessionId, sessionName, baseBranch = 'main', userId } = req.body;

  if (!repoFullName || !sessionId || !sessionName) {
    res.status(400).json({ error: 'Repository name, session ID, and session name required' });
    return;
  }

  // Require userId for session creation
  if (!userId) {
    res.status(400).json({ error: 'User ID required for session creation' });
    return;
  }

  // Check if Supabase is available
  if (!isSupabaseAvailable()) {
    res.status(503).json({ error: 'Database service unavailable. Please try again later.' });
    return;
  }

  // Auto-migrate legacy workspace structure if needed
  const migrated = migrateWorkspaceIfNeeded(repoFullName);
  const mainRepoPath = getMainRepoPath(repoFullName);

  if (!migrated && !fs.existsSync(mainRepoPath)) {
    res.status(400).json({ error: 'Workspace not found. Please set up the repository first.' });
    return;
  }

  try {
    // Check if session already exists in Supabase (sole source of truth)
    const existingSession = await getSupabaseWorkspaceSession(sessionId);

    if (existingSession) {
      // Update last accessed time
      await touchSupabaseWorkspaceSession(sessionId);
      console.log(`[Session Create] Found existing session ${sessionId} in Supabase`);

      // Session already exists, return its info
      res.json({
        sessionId: existingSession.session_id,
        name: existingSession.name,
        branchName: existingSession.branch_name,
        baseBranch: existingSession.base_branch,
        baseCommit: existingSession.base_commit || '',
        worktreePath: '', // Worktree is local, will be resolved separately
        createdAt: existingSession.created_at,
        lastAccessedAt: existingSession.last_accessed_at,
        isExisting: true
      });
      return;
    }

    // Create new session worktree and save to Supabase
    const sessionInfo = await createWorkspaceSessionWorktree(repoFullName, sessionId, sessionName, baseBranch, userId);

    res.json({
      sessionId: sessionInfo.session_id,
      name: sessionInfo.name,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      createdAt: sessionInfo.created_at,
      lastAccessedAt: sessionInfo.last_accessed_at,
      isExisting: false
    });
  } catch (error: any) {
    console.error('Error creating workspace session:', error);
    res.status(500).json({ error: `Failed to create session: ${error.message}` });
  }
});

// Delete a workspace session and its worktree
app.delete('/api/workspace/session/:sessionId', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { repoFullName } = req.query;

  if (!repoFullName) {
    res.status(400).json({ error: 'Repository name required' });
    return;
  }

  try {
    // Delete worktree and branch (now also deletes from Supabase)
    const success = await deleteWorkspaceSessionWorktree(repoFullName as string, sessionId);

    if (success) {
      res.json({ success: true, message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error: any) {
    console.error('Error deleting workspace session:', error);
    res.status(500).json({ error: `Failed to delete session: ${error.message}` });
  }
});

// List all workspace sessions for a repo
app.get('/api/workspace/sessions/:owner/:repo', authenticateApiKey, async (req: Request, res: Response) => {
  const repoFullName = `${req.params.owner}/${req.params.repo}`;
  const userId = req.query.userId as string | undefined;

  try {
    // Require userId for session listing
    if (!userId) {
      res.status(400).json({ error: 'User ID required for session listing' });
      return;
    }

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      res.status(503).json({ error: 'Database service unavailable. Please try again later.' });
      return;
    }

    // Get sessions from Supabase (sole source of truth)
    const supabaseSessions = await listSupabaseWorkspaceSessions(repoFullName, userId);
    console.log(`[Sessions List] Found ${supabaseSessions.length} sessions in Supabase for ${repoFullName} (user: ${userId})`);

    const sessions = supabaseSessions.map(session => ({
      sessionId: session.session_id,
      name: session.name,
      branchName: session.branch_name,
      baseBranch: session.base_branch,
      baseCommit: session.base_commit || '',
      worktreePath: '', // Worktree path is local, resolved when session is loaded
      createdAt: session.created_at,
      lastAccessedAt: session.last_accessed_at,
      messageCount: 0, // Will be populated separately if needed
      isValid: isWorkspaceSessionWorktreeValid(session.session_id)
    }));

    res.json({ sessions });
  } catch (error: any) {
    console.error('Error listing workspace sessions:', error);
    res.status(500).json({ error: `Failed to list sessions: ${error.message}` });
  }
});

// Get a specific workspace session
app.get('/api/workspace/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const sessionInfo = getWorkspaceSessionInfo(sessionId);
    if (!sessionInfo) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get conversation messages for this session
    const conversations = db.prepare(`
      SELECT messages FROM conversations WHERE workspace_session_id = ? ORDER BY updated_at DESC LIMIT 1
    `).get(sessionId) as { messages: string } | undefined;

    const messages = conversations ? JSON.parse(conversations.messages) : [];

    res.json({
      sessionId: sessionInfo.session_id,
      name: sessionInfo.name,
      branchName: sessionInfo.branch_name,
      baseBranch: sessionInfo.base_branch,
      baseCommit: sessionInfo.base_commit,
      worktreePath: sessionInfo.worktree_path,
      createdAt: sessionInfo.created_at,
      lastAccessedAt: sessionInfo.last_accessed_at,
      messages,
      isValid: isWorkspaceSessionWorktreeValid(sessionId)
    });
  } catch (error: any) {
    console.error('Error getting workspace session:', error);
    res.status(500).json({ error: `Failed to get session: ${error.message}` });
  }
});

// Rename a workspace session
app.put('/api/workspace/session/:sessionId', authenticateApiKey, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }

  try {
    // Update in SQLite
    const result = db.prepare('UPDATE workspace_sessions SET name = ?, last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(name, sessionId);

    // Also update in Supabase
    await updateSupabaseWorkspaceSession(sessionId, { name });

    if (result.changes === 0) {
      // Check if it exists in Supabase even if not in SQLite
      const supabaseSession = await getSupabaseWorkspaceSession(sessionId);
      if (!supabaseSession) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
    }

    res.json({ success: true, name });
  } catch (error: any) {
    console.error('Error renaming workspace session:', error);
    res.status(500).json({ error: `Failed to rename session: ${error.message}` });
  }
});

// Preview proxy endpoint - proxies requests to dev servers running in worktrees
app.get('/api/preview/proxy', authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const port = req.query.port as string || '3000';
  const reqPath = req.query.path as string || '/';

  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  // Verify session exists
  const session = db.prepare('SELECT * FROM workspace_sessions WHERE session_id = ?').get(sessionId) as any;
  const terminalSession = db.prepare('SELECT * FROM terminal_sessions WHERE session_id = ?').get(sessionId) as any;
  
  if (!session && !terminalSession) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    // Proxy request to localhost:port
    const targetUrl = 'http://localhost:' + port + reqPath;
    
    const proxyRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': (req.headers.accept as string) || '*/*',
        'Accept-Encoding': (req.headers['accept-encoding'] as string) || '',
        'User-Agent': (req.headers['user-agent'] as string) || 'LawlessAI-Preview',
      },
    });

    // Forward response headers
    const contentType = proxyRes.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);
    
    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    // Stream response body
    const buffer = await proxyRes.arrayBuffer();
    res.status(proxyRes.status).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Preview proxy error:', error);
    if (error.code === 'ECONNREFUSED') {
      res.status(502).json({ error: 'Dev server not running on port ' + port });
    } else {
      res.status(502).json({ error: 'Failed to proxy: ' + error.message });
    }
  }
});


// Vercel Preview Proxy - strips X-Frame-Options to allow iframe embedding
app.get('/preview/vercel', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const reqPath = req.query.path as string || '/';

  if (!url) {
    res.status(400).json({ error: 'URL parameter required' });
    return;
  }

  // Only allow Vercel URLs
  if (!url.includes('.vercel.app')) {
    res.status(400).json({ error: 'Only Vercel URLs are supported' });
    return;
  }

  try {
    const targetUrl = url.startsWith('https://') ? url : 'https://' + url;
    const fullUrl = targetUrl + reqPath;

    console.log('[Vercel Preview] Proxying:', fullUrl);

    const proxyRes = await fetch(fullUrl, {
      headers: {
        'Accept': req.headers.accept as string || 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': req.headers['accept-language'] as string || 'en-US,en;q=0.9',
        'User-Agent': req.headers['user-agent'] as string || 'Mozilla/5.0 LawlessAI-Preview',
      },
    });

    const contentType = proxyRes.headers.get('content-type') || 'text/html';

    // Set response headers - explicitly NOT setting X-Frame-Options
    res.setHeader('Content-Type', contentType);
    
    const cacheControl = proxyRes.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    if (contentType.includes('text/html')) {
      let html = await proxyRes.text();
      
      // Rewrite URLs to go through our proxy
      const proxyBase = '/preview/vercel?url=' + encodeURIComponent(url) + '&path=';
      
      // Rewrite href and src attributes starting with /
      html = html.replace(/(href|src)="\/([^"]*?)"/g, (match: string, attr: string, path: string) => {
        if (path.startsWith('data:') || path.startsWith('http')) return match;
        return attr + '="' + proxyBase + encodeURIComponent('/' + path) + '"';
      });
      
      // Add base tag for relative URLs
      if (!html.includes('<base')) {
        html = html.replace('<head>', '<head><base href="' + targetUrl + '/">');
      }
      
      res.status(proxyRes.status).send(html);
    } else {
      const buffer = await proxyRes.arrayBuffer();
      res.status(proxyRes.status).send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('[Vercel Preview] Error:', error);
    res.status(502).json({ error: 'Failed to fetch: ' + error.message });
  }
});



// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server for terminal sessions with keep-alive
const wss = new WebSocketServer({
  server,
  path: '/ws/terminal',
  // Server-side ping every 30 seconds to keep connections alive through proxies
  perMessageDeflate: false,
});

// Track alive status for ping/pong
const isAlive = new Map<WebSocket, boolean>();

// Send pings every 30 seconds to keep connections alive
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (isAlive.get(ws) === false) {
      console.log('Terminating stale WebSocket connection');
      return ws.terminate();
    }
    isAlive.set(ws, false);
    ws.ping();
  });
}, 30000);

// Store active terminal sessions
const terminalSessions = new Map<string, pty.IPty>();

wss.on('connection', (ws: WebSocket, req) => {
  // Mark connection as alive for ping/pong
  isAlive.set(ws, true);
  ws.on('pong', () => {
    isAlive.set(ws, true);
  });

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const repoFullName = url.searchParams.get('repo');
  const clientSessionId = url.searchParams.get('session');

  // Use client-provided session ID if available
  const sessionId = clientSessionId || uuidv4();

  console.log(`Terminal WebSocket connected: ${sessionId}, repo: ${repoFullName}`);

  if (!repoFullName) {
    ws.send(JSON.stringify({ type: 'error', message: 'Repository name required' }));
    ws.close();
    return;
  }

  const mainRepoPath = getMainRepoPath(repoFullName);

  if (!fs.existsSync(mainRepoPath)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Workspace not found. Please set up the repository first.' }));
    ws.close();
    return;
  }

  // Check if this session has an existing worktree
  let sessionInfo = getSessionInfo(sessionId);
  let isNewSession = false;
  let workingDirectory: string;

  if (sessionInfo && isSessionWorktreeValid(sessionId)) {
    // Reconnecting to existing session
    workingDirectory = sessionInfo.worktree_path;
    updateSessionAccess(sessionId);
    console.log(`Reconnecting to existing session worktree: ${workingDirectory}`);
  } else if (sessionInfo) {
    // Session exists but worktree is invalid - clean up and recreate
    console.log(`Session ${sessionId} has invalid worktree, recreating...`);
    db.prepare('DELETE FROM terminal_sessions WHERE session_id = ?').run(sessionId);
    sessionInfo = createSessionWorktree(repoFullName, sessionId);
    workingDirectory = sessionInfo.worktree_path;
    isNewSession = true;
  } else {
    // New session - create worktree
    console.log(`Creating new session worktree for: ${sessionId}`);
    sessionInfo = createSessionWorktree(repoFullName, sessionId);
    workingDirectory = sessionInfo.worktree_path;
    isNewSession = true;
  }

  // Create tmux session name from session ID
  const tmuxSessionName = "lw_" + sessionId.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);

  // Check if tmux session already exists
  const tmuxSessionExists = (): boolean => {
    try {
      execSync("tmux has-session -t " + tmuxSessionName + " 2>/dev/null");
      return true;
    } catch {
      return false;
    }
  };

  const existingTmux = tmuxSessionExists();
  console.log("tmux session " + tmuxSessionName + ": " + (existingTmux ? "exists, attaching" : "creating new"));

  // If no existing session, create one first (detached)
  if (!existingTmux) {
    try {
      execSync("tmux new-session -d -s " + tmuxSessionName + " -c " + JSON.stringify(workingDirectory));
      console.log("Created new tmux session: " + tmuxSessionName);
    } catch (err) {
      console.error("Failed to create tmux session:", err);
    }
  }

  // Spawn PTY that attaches to the tmux session
  const ptyProcess = pty.spawn("tmux", ["attach-session", "-t", tmuxSessionName], {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: workingDirectory,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      HOME: process.env.HOME || "/home/ubuntu",
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    } as { [key: string]: string },
  });

  terminalSessions.set(sessionId, ptyProcess);

  // Send initial message with session info
  ws.send(JSON.stringify({
    type: "connected",
    sessionId,
    tmuxSession: tmuxSessionName,
    branchName: sessionInfo.branch_name,
    baseBranch: sessionInfo.base_branch,
    baseCommit: sessionInfo.base_commit,
    isNewSession: !existingTmux,
    reconnected: existingTmux,
    message: existingTmux
      ? "[Reconnected] tmux:" + tmuxSessionName + " | Branch: " + sessionInfo.branch_name + "\r\n"
      : "[New Session] tmux:" + tmuxSessionName + " | Branch: " + sessionInfo.branch_name + "\r\n"
  }));

  // Only start Claude CLI for new tmux sessions
  if (!existingTmux) {
    setTimeout(() => {
      ptyProcess.write("claude --dangerously-skip-permissions\r");
    }, 500);
  }

  // Pipe PTY output to WebSocket
  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`PTY exited with code ${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
    }
    terminalSessions.delete(sessionId);
  });

  // Handle incoming messages from client
  ws.on('message', (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'input':
          ptyProcess.write(msg.data);
          break;
        case 'resize':
          if (msg.cols && msg.rows) {
            ptyProcess.resize(msg.cols, msg.rows);
          }
          break;
        case 'restart':
          // Kill current process and restart Claude
          ptyProcess.write('\x03'); // Ctrl+C
          setTimeout(() => {
            ptyProcess.write('claude --dangerously-skip-permissions\r');
          }, 500);
          break;
        case 'ping':
          // Respond to keep-alive ping
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (e) {
      // If not JSON, treat as raw input
      ptyProcess.write(message.toString());
    }
  });

  ws.on('close', () => {
    console.log(`Terminal WebSocket disconnected: ${sessionId}`);
    isAlive.delete(ws);
    const session = terminalSessions.get(sessionId);
    if (session) {
      session.kill();
      terminalSessions.delete(sessionId);
    }
  });

  ws.on('error', (err) => {
    console.error(`Terminal WebSocket error: ${err.message}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Lawless AI Backend Server                       ║
╠═══════════════════════════════════════════════════════════╣
║  Port:     ${String(PORT).padEnd(45)}║
║  WebSocket: ws://localhost:${PORT}/ws/terminal${' '.repeat(26)}║
║  Database: ${dbPath.slice(-45).padEnd(45)}║
║  CORS:     ${(allowedOrigins[0] || 'all origins').slice(0, 45).padEnd(45)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown - clean up ping interval
process.on('SIGTERM', () => {
  clearInterval(pingInterval);
  wss.close();
  server.close();
});

export default app;
