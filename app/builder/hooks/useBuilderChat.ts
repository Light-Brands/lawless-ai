import { useState, useCallback, useRef, useEffect } from 'react';
import type { BuilderType, BuilderMessage } from '@/app/types/builder';

interface DocumentSections {
  [key: string]: string;
}

interface UseBuilderChatReturn {
  messages: BuilderMessage[];
  isLoading: boolean;
  error: string | null;
  documentSections: DocumentSections;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  setMessages: React.Dispatch<React.SetStateAction<BuilderMessage[]>>;
  setDocumentSections: React.Dispatch<React.SetStateAction<DocumentSections>>;
  startConversation: () => void;
}

interface UseBuilderChatOptions {
  brandName: string;
  builderType: BuilderType;
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
  const { brandName, builderType, onDocumentUpdate } = options;
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [documentSections, setDocumentSections] = useState<DocumentSections>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !brandName) return;

      setIsLoading(true);
      setError(null);

      // Add user message immediately
      const userMessage: BuilderMessage = { role: 'user', content: message };
      setMessages((prev) => [...prev, userMessage]);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Build current document state for context
        const currentDocument = buildCurrentDocument(documentSections, builderType);

        const response = await fetch('/api/builder/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName,
            builderType,
            message,
            history: messages,
            currentDocument: currentDocument || undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let assistantContent = '';
        let buffer = '';
        let currentEventType = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (currentEventType === 'text' && data.content !== undefined) {
                  // Text chunk - accumulate for display
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantContent;
                    } else {
                      newMessages.push({ role: 'assistant', content: assistantContent });
                    }
                    return newMessages;
                  });
                } else if (currentEventType === 'document_update' && data.section !== undefined) {
                  // Document update - update sections
                  setDocumentSections((prev) => ({
                    ...prev,
                    [data.section]: data.content,
                  }));
                  onDocumentUpdate?.(data.section, data.content);
                } else if (currentEventType === 'clean_text' && data.content !== undefined) {
                  // Clean text replaces the accumulated content (without tags)
                  assistantContent = data.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage?.role === 'assistant') {
                      lastMessage.content = assistantContent;
                    }
                    return newMessages;
                  });
                } else if (currentEventType === 'error' && data.message) {
                  setError(data.message);
                }
              } catch {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        // Add error as assistant message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${errorMessage}` },
        ]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [brandName, builderType, messages, documentSections, onDocumentUpdate]
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
    setMessages([{ role: 'assistant', content: greeting }]);
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

// Helper to build current document from sections
function buildCurrentDocument(sections: DocumentSections, builderType: BuilderType): string {
  const sectionOrder =
    builderType === 'plan'
      ? ['overview', 'goals', 'target_users', 'key_features', 'technical_stack', 'success_metrics', 'timeline']
      : ['brand_overview', 'mission_statement', 'voice_and_tone', 'visual_identity', 'target_audience', 'brand_personality'];

  const sectionTitles: Record<string, string> =
    builderType === 'plan'
      ? {
          overview: 'Overview',
          goals: 'Goals',
          target_users: 'Target Users',
          key_features: 'Key Features',
          technical_stack: 'Technical Stack',
          success_metrics: 'Success Metrics',
          timeline: 'Timeline',
        }
      : {
          brand_overview: 'Brand Overview',
          mission_statement: 'Mission Statement',
          voice_and_tone: 'Voice & Tone',
          visual_identity: 'Visual Identity',
          target_audience: 'Target Audience',
          brand_personality: 'Brand Personality',
        };

  let document = '';
  for (const section of sectionOrder) {
    if (sections[section]) {
      document += `## ${sectionTitles[section]}\n${sections[section]}\n\n`;
    }
  }

  return document.trim();
}
