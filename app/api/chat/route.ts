import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { getConversation, addMessage, buildPromptWithHistory } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { message, sessionId } = await request.json();

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get conversation history and add user message
  const history = getConversation(sessionId);
  history.push({ role: 'user', content: message });

  // Build the full prompt
  const fullPrompt = buildPromptWithHistory(history);

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let responseContent = '';
      let errorOutput = '';

      // Spawn Claude CLI process
      const claude = spawn('claude', ['-p', fullPrompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' },
      });

      claude.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        responseContent += chunk;
        const sseData = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      });

      claude.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code: number | null) => {
        if (code === 0 && responseContent) {
          // Save assistant response to history
          addMessage(sessionId, { role: 'user', content: message });
          addMessage(sessionId, { role: 'assistant', content: responseContent });

          const sseData = `data: ${JSON.stringify({ type: 'done', content: responseContent })}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } else {
          const errorMsg = errorOutput || `Claude CLI exited with code ${code}`;
          const sseData = `data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }
        controller.close();
      });

      claude.on('error', (err: Error) => {
        console.error('Failed to start Claude CLI:', err);
        const sseData = `data: ${JSON.stringify({
          type: 'error',
          content: 'Failed to start Claude CLI. Make sure claude is installed and accessible in your PATH.',
        })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
