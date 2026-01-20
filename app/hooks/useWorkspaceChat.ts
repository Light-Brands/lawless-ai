'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Message,
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  SimpleMessage,
  ChatEvent,
} from '../types/chat';

export interface UseWorkspaceChatOptions {
  repoFullName: string;
  sessionId?: string | null;
  persistMessages?: boolean;
  onMessageStart?: () => void;
  onMessageEnd?: () => void;
  onError?: (error: string) => void;
  onToolUse?: (tool: string, input: Record<string, unknown>) => void;
  onToolResult?: (id: string, success: boolean) => void;
}

export interface UseWorkspaceChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  toggleThinking: (messageIndex: number, blockIndex: number) => void;
  clearMessages: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useWorkspaceChat(options: UseWorkspaceChatOptions): UseWorkspaceChatReturn {
  const {
    repoFullName,
    sessionId,
    persistMessages = true,
    onMessageStart,
    onMessageEnd,
    onError,
    onToolUse,
    onToolResult,
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Track tool blocks by ID for updates
  const toolBlocksRef = useRef<Map<string, number>>(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);

  // Load chat history from database
  useEffect(() => {
    if (!persistMessages || !sessionId || hasLoadedRef.current) return;

    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(`/api/ide/chat?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            // Convert stored messages back to Message format
            const loadedMessages: Message[] = data.messages.map((msg: {
              id: string;
              role: 'user' | 'assistant';
              content: string;
              timestamp: string;
              metadata?: { hasThinking?: boolean; hasToolUse?: boolean; toolNames?: string[] };
            }) => ({
              id: msg.id,
              role: msg.role,
              content: [{ type: 'text' as const, content: msg.content }],
              timestamp: new Date(msg.timestamp),
              sessionId,
            }));
            setMessages(loadedMessages);
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsLoadingHistory(false);
        hasLoadedRef.current = true;
      }
    }

    loadHistory();
  }, [persistMessages, sessionId]);

  // Save messages to database (debounced)
  const saveMessagesToDatabase = useCallback(async (messagesToSave: Message[]) => {
    if (!persistMessages || !sessionId || messagesToSave.length === 0) return;

    try {
      await fetch('/api/ide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          repoFullName,
          messages: messagesToSave,
        }),
      });
    } catch (err) {
      console.error('Failed to save chat messages:', err);
    }
  }, [persistMessages, sessionId, repoFullName]);

  // Schedule save after messages change
  useEffect(() => {
    if (!persistMessages || messages.length === 0 || isLoadingHistory) return;

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMessagesToDatabase(messages);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, persistMessages, isLoadingHistory, saveMessagesToDatabase]);

  // Build conversation history from messages
  const buildConversationHistory = useCallback((): SimpleMessage[] => {
    return messages
      .map((msg) => {
        const textContent = msg.content
          .filter((c): c is TextBlock => c.type === 'text')
          .map((c) => c.content)
          .join('\n');
        return { role: msg.role, content: textContent };
      })
      .filter((msg) => msg.content.trim());
  }, [messages]);

  // Send message and handle streaming response
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);
      onMessageStart?.();

      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', content }],
        timestamp: new Date(),
        sessionId: sessionId || undefined,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Add empty assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: [],
        timestamp: new Date(),
        sessionId: sessionId || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Reset tool blocks tracking
      toolBlocksRef.current.clear();

      // Build conversation history (excluding the messages we just added)
      const conversationHistory = buildConversationHistory();

      try {
        const response = await fetch('/api/workspace/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            repoFullName,
            workspaceSessionId: sessionId,
            conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: ChatEvent = JSON.parse(line.slice(6));

                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role !== 'assistant') return prev;

                  const contentBlocks = [...lastMessage.content];

                  switch (data.type) {
                    case 'text':
                    case 'chunk': {
                      // Append to last text block or create new one
                      const lastBlock = contentBlocks[contentBlocks.length - 1];
                      if (lastBlock && lastBlock.type === 'text') {
                        (lastBlock as TextBlock).content += data.content;
                      } else {
                        contentBlocks.push({ type: 'text', content: data.content });
                      }
                      break;
                    }

                    case 'thinking': {
                      contentBlocks.push({
                        type: 'thinking',
                        content: data.content,
                        collapsed: true,
                      } as ThinkingBlock);
                      break;
                    }

                    case 'tool_use': {
                      const toolBlock: ToolUseBlock = {
                        type: 'tool_use',
                        id: data.id,
                        tool: data.tool,
                        input: data.input || {},
                        status: 'running',
                      };
                      contentBlocks.push(toolBlock);
                      toolBlocksRef.current.set(data.id, contentBlocks.length - 1);
                      onToolUse?.(data.tool, data.input);
                      break;
                    }

                    case 'tool_result': {
                      const toolIndex = toolBlocksRef.current.get(data.id);
                      if (toolIndex !== undefined && contentBlocks[toolIndex]?.type === 'tool_use') {
                        const block = contentBlocks[toolIndex] as ToolUseBlock;
                        block.status = data.success ? 'success' : 'error';
                        block.output = data.output;
                        onToolResult?.(data.id, data.success);
                      }
                      break;
                    }

                    case 'error': {
                      contentBlocks.push({
                        type: 'error',
                        content: data.message,
                      });
                      setError(data.message);
                      onError?.(data.message);
                      break;
                    }
                  }

                  newMessages[newMessages.length - 1] = { ...lastMessage, content: contentBlocks };
                  return newMessages;
                });
              } catch (e) {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const errorMessage = err.message || 'Failed to get response';
        setError(errorMessage);
        onError?.(errorMessage);

        // Add error to assistant message
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content.push({ type: 'error', content: errorMessage });
          }
          return newMessages;
        });
      } finally {
        setIsLoading(false);
        onMessageEnd?.();
      }
    },
    [
      isLoading,
      sessionId,
      repoFullName,
      buildConversationHistory,
      onMessageStart,
      onMessageEnd,
      onError,
      onToolUse,
      onToolResult,
    ]
  );

  // Toggle thinking block collapse state
  const toggleThinking = useCallback((messageIndex: number, blockIndex: number) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const block = newMessages[messageIndex]?.content[blockIndex];
      if (block && block.type === 'thinking') {
        (block as ThinkingBlock).collapsed = !(block as ThinkingBlock).collapsed;
      }
      return [...newMessages];
    });
  }, []);

  // Clear all messages (and from database if persisting)
  const clearMessages = useCallback(async () => {
    setMessages([]);
    setError(null);

    if (persistMessages && sessionId) {
      try {
        await fetch(`/api/ide/chat?sessionId=${sessionId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to clear chat history from database:', err);
      }
    }
  }, [persistMessages, sessionId]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    toggleThinking,
    clearMessages,
    setMessages,
  };
}
