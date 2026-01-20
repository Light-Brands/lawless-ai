'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BuilderType } from '@/app/types/builder';
import type { Message, ContentBlock, TextBlock, ChatEvent } from '@/app/types/chat';

interface DocumentSections {
  [key: string]: string;
}

interface UseBuilderChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  documentSections: DocumentSections;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setDocumentSections: React.Dispatch<React.SetStateAction<DocumentSections>>;
  startConversation: () => void;
}

interface BrandContext {
  websiteUrl?: string;
  websiteSummary?: string;
  brandColors?: string[];
  brandFonts?: string[];
  tagline?: string;
  description?: string;
  additionalNotes?: string;
}

interface UseBuilderChatOptions {
  brandName: string;
  builderType: BuilderType;
  brandContext?: BrandContext;
  onDocumentUpdate?: (section: string, content: string) => void;
}

// Initial greeting messages
const PLAN_GREETING = `Hello! I'm here to help you build a comprehensive project plan for your brand.

I'll guide you through each section step by step. We'll cover:
1. Project Overview
2. Goals
3. Target Users
4. Key Features
5. Technical Stack
6. Success Metrics
7. Timeline

Let's start with the **Project Overview**. What is this project about? What problem does it solve?`;

const IDENTITY_GREETING = `Hello! I'm here to help you create a compelling brand identity.

I'll guide you through defining what makes your brand unique. We'll cover:
1. Brand Overview
2. Mission Statement
3. Voice & Tone
4. Visual Identity
5. Target Audience
6. Brand Personality

Let's start with the **Brand Overview**. What does your brand stand for? What makes it unique?`;

export function useBuilderChat(options: UseBuilderChatOptions): UseBuilderChatReturn {
  const { brandName, builderType, brandContext, onDocumentUpdate } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [documentSections, setDocumentSections] = useState<DocumentSections>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build conversation history from messages (matching workspace pattern)
  const buildConversationHistory = useCallback(() => {
    return messages.map((msg) => {
      const textContent = msg.content
        .filter((c): c is TextBlock => c.type === 'text')
        .map((c) => c.content)
        .join('\n');
      return { role: msg.role, content: textContent };
    }).filter((msg) => msg.content.trim());
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !brandName || isLoading) return;

      setIsLoading(true);
      setError(null);

      // Add user message (matching workspace pattern with content blocks)
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', content }],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Add empty assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Build conversation history
      const conversationHistory = buildConversationHistory();

      try {
        const response = await fetch('/api/builder/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName,
            builderType,
            message: content,
            history: conversationHistory,
            currentDocument: documentSections['_raw_content'] || null,
            brandContext: brandContext || null,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Handle streaming response (matching workspace pattern exactly)
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

                    case 'tool_use': {
                      // Handle document updates
                      if (data.tool === 'document_update' && data.input) {
                        const { section, content: sectionContent } = data.input as { section: string; content: string };
                        if (section && sectionContent) {
                          setDocumentSections((prev) => ({
                            ...prev,
                            [section]: sectionContent,
                          }));
                          onDocumentUpdate?.(section, sectionContent);
                        }
                      }
                      break;
                    }

                    case 'error': {
                      contentBlocks.push({
                        type: 'error',
                        content: data.message,
                      });
                      setError(data.message);
                      break;
                    }
                  }

                  newMessages[newMessages.length - 1] = { ...lastMessage, content: contentBlocks };
                  return newMessages;
                });
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Chat error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);

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
        abortControllerRef.current = null;
      }
    },
    [brandName, builderType, isLoading, buildConversationHistory, onDocumentUpdate]
  );

  const clearMessages = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setDocumentSections({});
    setError(null);
    hasInitialized.current = false;
  }, []);

  const startConversation = useCallback(() => {
    if (hasInitialized.current || messages.length > 0) return;
    hasInitialized.current = true;

    const greeting = builderType === 'plan' ? PLAN_GREETING : IDENTITY_GREETING;
    const greetingMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: [{ type: 'text', content: greeting }],
      timestamp: new Date(),
    };
    setMessages([greetingMessage]);
  }, [builderType, messages.length]);

  // Auto-start conversation when brand is selected and messages are empty
  useEffect(() => {
    if (brandName && messages.length === 0 && !hasInitialized.current) {
      startConversation();
    }
  }, [brandName, messages.length, startConversation]);

  return {
    messages,
    isLoading,
    error,
    documentSections,
    sendMessage,
    clearMessages,
    setMessages,
    setDocumentSections,
    startConversation,
  };
}
