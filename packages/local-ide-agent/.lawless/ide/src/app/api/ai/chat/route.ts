import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for the local IDE agent
const SYSTEM_PROMPT = `You are Claude, an AI assistant embedded in a local development environment. You help developers build and modify their websites in real-time.

You have access to the following capabilities:
- Edit files in the project
- Run terminal commands
- Query and modify the database (Supabase)
- Commit and push changes to GitHub
- View deployment status on Vercel

When the user selects an element on their page, you'll receive context about that element including:
- The HTML tag name
- The React component name (if available)
- The source file path and line number

Your responses should be:
1. Concise and actionable
2. Focused on the specific element or task
3. Ready to make changes immediately when asked

When editing files:
- Make minimal, targeted changes
- Preserve existing code style
- Explain what you're changing briefly

Remember: Changes you make will be reflected instantly via hot reload, so the user will see results immediately.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, selectedElement } = await req.json();

    // Build the conversation with context
    const conversationMessages = messages.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '8096'),
      system: SYSTEM_PROMPT,
      messages: conversationMessages,
    });

    // Extract text content from the response
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Chat API error:', error);

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your ANTHROPIC_API_KEY.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
