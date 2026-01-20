import { useState, useCallback } from 'react';
import { useIDEStore } from '../stores/ideStore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChat() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { messages, addMessage } = useIDEStore();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    addMessage({ role: 'user', content });
    setIsLoading(true);

    try {
      const response = await fetch('/api/lawless/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      addMessage({ role: 'assistant', content: data.content });
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure your API key is configured correctly.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, addMessage]);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
  };
}
