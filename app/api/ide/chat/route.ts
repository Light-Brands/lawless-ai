import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getOrCreateConversation,
  getConversationByWorkspaceSession,
  appendMessages,
} from '@/lib/supabase/services/conversations';
import type { Message as ChatMessage } from '@/app/types/chat';
import type { Json } from '@/types/database';

// Simplified message format for database storage
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    hasThinking?: boolean;
    hasToolUse?: boolean;
    toolNames?: string[];
  };
}

// Convert rich messages to simple format for storage
function simplifyMessages(messages: ChatMessage[]): StoredMessage[] {
  return messages.map((msg) => {
    const textContent = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { content: string }).content)
      .join('\n');

    const hasThinking = msg.content.some((c) => c.type === 'thinking');
    const toolBlocks = msg.content.filter((c) => c.type === 'tool_use');
    const hasToolUse = toolBlocks.length > 0;
    const toolNames = toolBlocks.map((c) => (c as { tool: string }).tool);

    return {
      id: msg.id,
      role: msg.role,
      content: textContent,
      timestamp: msg.timestamp.toISOString(),
      metadata: {
        ...(hasThinking && { hasThinking }),
        ...(hasToolUse && { hasToolUse, toolNames }),
      },
    };
  });
}

// GET - Load chat history for a workspace session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get conversation by workspace session ID
    const conversation = await getConversationByWorkspaceSession(supabase, sessionId);

    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }

    // Return messages from conversation
    const messages = (conversation.messages as StoredMessage[]) || [];

    return NextResponse.json({
      conversationId: conversation.id,
      messages,
      title: conversation.title,
      lastMessageAt: conversation.last_message_at,
    });
  } catch (error) {
    console.error('Error loading chat history:', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

// POST - Save chat messages for a workspace session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, repoFullName, messages, userId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get or create conversation for this workspace session
    const conversation = await getOrCreateConversation(
      supabase,
      userId || 'anonymous',
      sessionId,
      repoFullName
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to get or create conversation' }, { status: 500 });
    }

    // Simplify and store messages
    const simplifiedMessages = simplifyMessages(messages);

    // Update conversation with all messages (replace, not append for IDE sessions)
    const { error } = await supabase
      .from('conversations')
      .update({
        messages: simplifiedMessages as unknown as Json,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', conversation.id);

    if (error) {
      console.error('Error saving messages:', error);
      return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      messageCount: simplifiedMessages.length,
    });
  } catch (error) {
    console.error('Error saving chat messages:', error);
    return NextResponse.json({ error: 'Failed to save chat messages' }, { status: 500 });
  }
}

// DELETE - Clear chat history for a workspace session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get conversation by workspace session ID
    const conversation = await getConversationByWorkspaceSession(supabase, sessionId);

    if (!conversation) {
      return NextResponse.json({ success: true });
    }

    // Clear messages
    const { error } = await supabase
      .from('conversations')
      .update({
        messages: [] as unknown as Json,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', conversation.id);

    if (error) {
      console.error('Error clearing chat history:', error);
      return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
