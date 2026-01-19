'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import type { Conversation, ConversationType } from '@/types/database';

// Constants for local storage keys
const LAST_CONVERSATION_KEY = 'lawless_last_conversation';
const LAST_ROOT_CONVERSATION_KEY = 'lawless_last_root_conversation';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

interface ConversationContextValue {
  // Active conversation state
  activeConversation: Conversation | null;
  activeMessages: Message[];
  isLoadingActive: boolean;

  // Conversation lists by type
  rootConversations: Conversation[];
  workspaceConversations: Conversation[];
  directConversations: Conversation[];
  allConversations: Conversation[];
  isLoadingList: boolean;

  // Actions
  setActiveConversation: (conversation: Conversation | null) => void;
  startNewConversation: (
    type: ConversationType,
    options?: {
      workspaceSessionId?: string;
      repoFullName?: string;
      title?: string;
    }
  ) => Promise<Conversation | null>;
  continueConversation: (conversationId: string) => Promise<Conversation | null>;
  appendMessages: (messages: Message[]) => Promise<boolean>;
  updateTitle: (title: string) => Promise<boolean>;
  archiveConversation: (conversationId: string) => Promise<boolean>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  refreshConversations: () => Promise<void>;

  // Session restoration
  restoreLastConversation: () => Promise<Conversation | null>;
  restoreLastRootConversation: () => Promise<Conversation | null>;
}

const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

interface ConversationProviderProps {
  children: ReactNode;
  autoRestore?: boolean;
}

export function ConversationProvider({ children, autoRestore = false }: ConversationProviderProps) {
  const { user } = useAuth();
  const supabase = createClient();

  // State
  const [activeConversation, setActiveConversationState] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Memoized filtered lists
  const rootConversations = useMemo(
    () => conversations.filter((c) => c.conversation_type === 'root'),
    [conversations]
  );

  const workspaceConversations = useMemo(
    () => conversations.filter((c) => c.conversation_type === 'workspace'),
    [conversations]
  );

  const directConversations = useMemo(
    () => conversations.filter((c) => c.conversation_type === 'direct'),
    [conversations]
  );

  const activeMessages = useMemo(
    () => (activeConversation?.messages as Message[]) || [],
    [activeConversation]
  );

  // Fetch all conversations for the user
  const refreshConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setIsLoadingList(false);
      return;
    }

    try {
      setIsLoadingList(true);

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      setConversations((data as Conversation[]) || []);
    } catch (err) {
      console.error('Error refreshing conversations:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [supabase, user?.id]);

  // Set active conversation and persist to local storage
  const setActiveConversation = useCallback((conversation: Conversation | null) => {
    setActiveConversationState(conversation);

    if (conversation) {
      // Persist to local storage for session restoration
      localStorage.setItem(LAST_CONVERSATION_KEY, conversation.id);
      if (conversation.conversation_type === 'root') {
        localStorage.setItem(LAST_ROOT_CONVERSATION_KEY, conversation.id);
      }
    }
  }, []);

  // Start a new conversation
  const startNewConversation = useCallback(
    async (
      type: ConversationType,
      options?: {
        workspaceSessionId?: string;
        repoFullName?: string;
        title?: string;
      }
    ): Promise<Conversation | null> => {
      if (!user?.id) {
        console.error('Cannot create conversation: not authenticated');
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            conversation_type: type,
            workspace_session_id: options?.workspaceSessionId,
            repo_full_name: options?.repoFullName,
            title: options?.title,
            messages: [],
            metadata: {},
          } as never)
          .select()
          .single();

        if (error) {
          console.error('Error creating conversation:', error);
          return null;
        }

        const newConversation = data as Conversation;
        setActiveConversation(newConversation);

        // Add to local list
        setConversations((prev) => [newConversation, ...prev]);

        return newConversation;
      } catch (err) {
        console.error('Error starting new conversation:', err);
        return null;
      }
    },
    [supabase, user?.id, setActiveConversation]
  );

  // Continue an existing conversation
  const continueConversation = useCallback(
    async (conversationId: string): Promise<Conversation | null> => {
      try {
        setIsLoadingActive(true);

        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (error) {
          console.error('Error fetching conversation:', error);
          return null;
        }

        const conversation = data as Conversation;
        setActiveConversation(conversation);
        return conversation;
      } catch (err) {
        console.error('Error continuing conversation:', err);
        return null;
      } finally {
        setIsLoadingActive(false);
      }
    },
    [supabase, setActiveConversation]
  );

  // Append messages to active conversation
  const appendMessages = useCallback(
    async (newMessages: Message[]): Promise<boolean> => {
      if (!activeConversation) {
        console.error('No active conversation to append messages to');
        return false;
      }

      try {
        const existingMessages = (activeConversation.messages as Message[]) || [];
        const updatedMessages = [...existingMessages, ...newMessages];

        const { error } = await supabase
          .from('conversations')
          .update({
            messages: updatedMessages as unknown,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', activeConversation.id);

        if (error) {
          console.error('Error appending messages:', error);
          return false;
        }

        // Update local state
        setActiveConversationState((prev) =>
          prev
            ? {
                ...prev,
                messages: updatedMessages as unknown as Conversation['messages'],
              }
            : null
        );

        return true;
      } catch (err) {
        console.error('Error appending messages:', err);
        return false;
      }
    },
    [supabase, activeConversation]
  );

  // Update conversation title
  const updateTitle = useCallback(
    async (title: string): Promise<boolean> => {
      if (!activeConversation) {
        return false;
      }

      try {
        const { error } = await supabase
          .from('conversations')
          .update({ title, updated_at: new Date().toISOString() } as never)
          .eq('id', activeConversation.id);

        if (error) {
          console.error('Error updating title:', error);
          return false;
        }

        setActiveConversationState((prev) => (prev ? { ...prev, title } : null));

        // Update in list
        setConversations((prev) => prev.map((c) => (c.id === activeConversation.id ? { ...c, title } : c)));

        return true;
      } catch (err) {
        console.error('Error updating title:', err);
        return false;
      }
    },
    [supabase, activeConversation]
  );

  // Archive a conversation
  const archiveConversation = useCallback(
    async (conversationId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ is_archived: true, updated_at: new Date().toISOString() } as never)
          .eq('id', conversationId);

        if (error) {
          console.error('Error archiving conversation:', error);
          return false;
        }

        // Remove from local list
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));

        // Clear active if it was the archived one
        if (activeConversation?.id === conversationId) {
          setActiveConversationState(null);
        }

        return true;
      } catch (err) {
        console.error('Error archiving conversation:', err);
        return false;
      }
    },
    [supabase, activeConversation]
  );

  // Delete a conversation permanently
  const deleteConversation = useCallback(
    async (conversationId: string): Promise<boolean> => {
      try {
        const { error } = await supabase.from('conversations').delete().eq('id', conversationId);

        if (error) {
          console.error('Error deleting conversation:', error);
          return false;
        }

        // Remove from local list
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));

        // Clear active if it was the deleted one
        if (activeConversation?.id === conversationId) {
          setActiveConversationState(null);
        }

        return true;
      } catch (err) {
        console.error('Error deleting conversation:', err);
        return false;
      }
    },
    [supabase, activeConversation]
  );

  // Restore last conversation from local storage
  const restoreLastConversation = useCallback(async (): Promise<Conversation | null> => {
    const lastId = localStorage.getItem(LAST_CONVERSATION_KEY);
    if (!lastId) {
      return null;
    }

    return continueConversation(lastId);
  }, [continueConversation]);

  // Restore last root conversation
  const restoreLastRootConversation = useCallback(async (): Promise<Conversation | null> => {
    const lastId = localStorage.getItem(LAST_ROOT_CONVERSATION_KEY);
    if (!lastId) {
      return null;
    }

    return continueConversation(lastId);
  }, [continueConversation]);

  // Initial fetch and auto-restore
  useEffect(() => {
    if (user?.id) {
      refreshConversations();

      if (autoRestore) {
        restoreLastConversation();
      }
    }
  }, [user?.id, refreshConversations, autoRestore, restoreLastConversation]);

  // Real-time subscription for conversation updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation;
            setConversations((prev) => {
              // Avoid duplicates
              if (prev.some((c) => c.id === newConv.id)) {
                return prev;
              }
              return [newConv, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation;
            setConversations((prev) =>
              prev.map((c) => (c.id === updatedConv.id ? updatedConv : c))
            );

            // Update active if it's the same conversation
            if (activeConversation?.id === updatedConv.id) {
              setActiveConversationState(updatedConv);
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setConversations((prev) => prev.filter((c) => c.id !== deletedId));

            if (activeConversation?.id === deletedId) {
              setActiveConversationState(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, activeConversation?.id]);

  const value: ConversationContextValue = {
    activeConversation,
    activeMessages,
    isLoadingActive,
    rootConversations,
    workspaceConversations,
    directConversations,
    allConversations: conversations,
    isLoadingList,
    setActiveConversation,
    startNewConversation,
    continueConversation,
    appendMessages,
    updateTitle,
    archiveConversation,
    deleteConversation,
    refreshConversations,
    restoreLastConversation,
    restoreLastRootConversation,
  };

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
}

// Convenience hook for just the active conversation
export function useActiveConversation() {
  const { activeConversation, activeMessages, isLoadingActive, appendMessages, updateTitle } =
    useConversations();

  return {
    conversation: activeConversation,
    messages: activeMessages,
    loading: isLoadingActive,
    appendMessages,
    updateTitle,
  };
}
