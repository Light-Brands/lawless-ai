/**
 * Lawless AI Chat Server
 *
 * This server acts as a bridge between the web frontend and Claude CLI,
 * allowing you to chat with Claude using your CLI subscription instead of API credits.
 *
 * How it works:
 * 1. Frontend sends a message to /api/chat
 * 2. Server spawns Claude CLI as a subprocess
 * 3. CLI response is streamed back to the frontend
 */

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Store conversation history per session
const conversations = new Map();

// Lawless AI System Prompt - defines the Solution Architect persona
const LAWLESS_SYSTEM_PROMPT = `You are Lawless AI, the Solution Architect - an AI-embodied extension designed to bridge technical complexity and human understanding. You channel divine light through ethical AI stewardship.

Your Core Identity:
- You make the complex accessible without sacrificing truth
- You meet people where they are and build understanding from there
- You use simplicity as a sign of mastery, not a compromise
- You empower understanding rather than create dependency

Your Communication Style:
- Warm and grounded: Technical knowledge delivered with human warmth
- Clear and direct: No unnecessary jargon
- Inviting and patient: Create space for questions
- Playful yet precise: Light touch that doesn't sacrifice accuracy

Your Decision Hierarchy:
1. DIGNITY over Efficiency
2. SIMPLICITY over Power
3. OVERSIGHT over Automation
4. TRUST over Speed

Start responses with the human relevance - why it matters - then layer in complexity as needed. Use bridge metaphors to connect unfamiliar technical concepts to everyday experiences.

You serve Light-Brands' mission: "Help bring structure to the light and launch light through systems that help to multiply impact rather than distort it."`;

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'lawless-ai-chat' });
});

/**
 * Create or get a conversation session
 */
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  conversations.set(sessionId, []);
  res.json({ sessionId });
});

/**
 * Chat endpoint - sends message to Claude CLI and streams response
 */
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Get or create conversation history
    let history = conversations.get(sessionId) || [];

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Build the prompt with system context
    const fullPrompt = buildPromptWithHistory(history);

    // Spawn Claude CLI process
    // The -p flag is for prompt, --no-markdown keeps raw text for our own rendering
    const claude = spawn('claude', ['-p', fullPrompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' }
    });

    let responseContent = '';
    let errorOutput = '';

    claude.stdout.on('data', (data) => {
      const chunk = data.toString();
      responseContent += chunk;
      // Send chunk as SSE
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    });

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0 && responseContent) {
        // Save assistant response to history
        history.push({ role: 'assistant', content: responseContent });
        conversations.set(sessionId, history);

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'done', content: responseContent })}\n\n`);
      } else {
        const errorMsg = errorOutput || `Claude CLI exited with code ${code}`;
        res.write(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`);
      }
      res.end();
    });

    claude.on('error', (err) => {
      console.error('Failed to start Claude CLI:', err);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        content: 'Failed to start Claude CLI. Make sure claude is installed and accessible in your PATH.'
      })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      claude.kill();
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

/**
 * Clear conversation history
 */
app.delete('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversations.delete(sessionId);
  res.json({ success: true });
});

/**
 * Build a prompt string that includes conversation history
 */
function buildPromptWithHistory(history) {
  let prompt = LAWLESS_SYSTEM_PROMPT + '\n\n';
  prompt += '---\n\nConversation:\n\n';

  for (const msg of history) {
    if (msg.role === 'user') {
      prompt += `Human: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  // End with indication that assistant should respond
  prompt += 'Assistant:';

  return prompt;
}

// Serve the main HTML file for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// Export app for Vercel serverless functions
export default app;

// Start server only when running directly (not on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ LAWLESS AI CHAT SERVER                                  ║
║                                                              ║
║   Server running at: http://localhost:${PORT}                  ║
║                                                              ║
║   This server bridges your web chat to Claude CLI,           ║
║   using your subscription instead of API credits.            ║
║                                                              ║
║   Make sure 'claude' CLI is installed and authenticated.     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}
