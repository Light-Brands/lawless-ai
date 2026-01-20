import { Router, Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticateApiKey } from '../middleware/auth';
import { SYSTEM_PROMPT, buildPromptWithHistory } from '../prompts/system';
import { conversationService } from '../services/conversationService';
import { isSupabaseAvailable, Message } from '../lib/supabase';

const router = Router();

// Chat endpoint with SSE streaming using Claude CLI SDK mode
// Now supports Supabase persistence for authenticated users
router.post('/api/chat', authenticateApiKey, async (req: Request, res: Response) => {
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
router.get('/api/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
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
router.delete('/api/session/:sessionId', authenticateApiKey, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const result = db.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({ success: true, message: 'Session deleted' });
});

// List recent sessions (SQLite - legacy)
router.get('/api/sessions', authenticateApiKey, (req: Request, res: Response) => {
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

export default router;
