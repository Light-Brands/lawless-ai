'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Conversation } from '@/types/database';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

interface UseConversationOptions {
  workspaceSessionId?: string;
  conversationId?: string;
  enabled?: boolean;
}

interface UseConversationReturn {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  appendMessages: (newMessages: Message[]) => Promise<boolean>;
  updateTitle: (title: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useConversation({
  workspaceSessionId,
  conversationId,
  enabled = true,
}: UseConversationOptions): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const refresh = useCallback(async () => {
    if (!enabled || (!workspaceSessionId && !conversationId)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('conversations').select('*');

      if (conversationId) {
        query = query.eq('id', conversationId);
      } else if (workspaceSessionId) {
        query = query.eq('workspace_session_id', workspaceSessionId);
      }

      const { data, error: fetchError } = await query
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        if (fetchError.code !== 'PGRST116') {
          throw new Error(fetchError.message);
        }
        // No conversation found - that's OK
        setConversation(null);
        return;
      }

      setConversation(data as Conversation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load conversation';
      console.error('Error fetching conversation:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceSessionId, conversationId, enabled]);

  const appendMessages = useCallback(
    async (newMessages: Message[]): Promise<boolean> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('Not authenticated');
        }

        if (conversation) {
          // Append to existing conversation
          const existingMessages = (conversation.messages as Message[]) || [];
          const updatedMessages = [...existingMessages, ...newMessages];

          const { error: updateError } = await supabase
            .from('conversations')
            .update({
              messages: updatedMessages as unknown,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', conversation.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          setConversation((prev) =>
            prev ? { ...prev, messages: updatedMessages as unknown as Conversation['messages'] } : null
          );
        } else if (workspaceSessionId) {
          // Create new conversation
          const { data: newConv, error: insertError } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              workspace_session_id: workspaceSessionId,
              messages: newMessages as unknown,
            } as never)
            .select()
            .single();

          if (insertError) {
            throw new Error(insertError.message);
          }

          setConversation(newConv as Conversation);
        } else {
          throw new Error('No conversation or workspace session ID');
        }

        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save messages';
        console.error('Error appending messages:', err);
        setError(message);
        return false;
      }
    },
    [supabase, conversation, workspaceSessionId]
  );

  const updateTitle = useCallback(
    async (title: string): Promise<boolean> => {
      if (!conversation) {
        return false;
      }

      try {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ title, updated_at: new Date().toISOString() } as never)
          .eq('id', conversation.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setConversation((prev) => (prev ? { ...prev, title } : null));
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update title';
        console.error('Error updating conversation title:', err);
        setError(message);
        return false;
      }
    },
    [supabase, conversation]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const messages = (conversation?.messages as Message[]) || [];

  return {
    conversation,
    messages,
    loading,
    error,
    appendMessages,
    updateTitle,
    refresh,
  };
}

// Hook for listing recent conversations
export function useConversations(limit = 20) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setConversations((data as Conversation[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations';
      console.error('Error fetching conversations:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { conversations, loading, error, refresh };
}
