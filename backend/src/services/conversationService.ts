import {
  getSupabaseClient,
  isSupabaseAvailable,
  ensureUserExists,
  Conversation,
  ConversationInsert,
  ConversationType,
  Message,
} from '../lib/supabase';

export interface CreateConversationOptions {
  userId: string;
  type?: ConversationType;
  workspaceSessionId?: string;
  repoFullName?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ListConversationsOptions {
  userId: string;
  type?: ConversationType | ConversationType[];
  workspaceSessionId?: string;
  repoFullName?: string;
  includeArchived?: boolean;
  limit?: number;
}

/**
 * Backend Conversation Service
 * Handles all conversation persistence to Supabase
 */
export class ConversationService {
  /**
   * Create a new conversation
   */
  async create(options: CreateConversationOptions): Promise<Conversation | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('Supabase not available, conversation not persisted');
      return null;
    }

    // Ensure user exists before creating conversation
    const userExists = await ensureUserExists(options.userId);
    if (!userExists) {
      console.error('Failed to ensure user exists:', options.userId);
      return null;
    }

    const insertData: ConversationInsert = {
      user_id: options.userId,
      conversation_type: options.type || 'root',
      workspace_session_id: options.workspaceSessionId,
      repo_full_name: options.repoFullName,
      title: options.title,
      metadata: options.metadata || {},
      messages: [],
    };

    const { data, error } = await supabase
      .from('conversations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    return data as Conversation;
  }

  /**
   * Get conversation by ID
   */
  async get(conversationId: string): Promise<Conversation | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching conversation:', error);
      }
      return null;
    }

    return data as Conversation;
  }

  /**
   * Get conversation by workspace session ID
   */
  async getByWorkspaceSession(workspaceSessionId: string): Promise<Conversation | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_session_id', workspaceSessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching conversation by workspace session:', error);
      }
      return null;
    }

    return data as Conversation;
  }

  /**
   * Get or create conversation for a workspace session
   */
  async getOrCreateForWorkspace(
    userId: string,
    workspaceSessionId: string,
    repoFullName?: string
  ): Promise<Conversation | null> {
    // Try to find existing
    const existing = await this.getByWorkspaceSession(workspaceSessionId);
    if (existing) {
      return existing;
    }

    // Create new
    return this.create({
      userId,
      type: 'workspace',
      workspaceSessionId,
      repoFullName,
    });
  }

  /**
   * Get or create a root conversation (general chat)
   */
  async getOrCreateRoot(userId: string, conversationId?: string): Promise<Conversation | null> {
    if (conversationId) {
      const existing = await this.get(conversationId);
      if (existing) {
        return existing;
      }
    }

    return this.create({
      userId,
      type: 'root',
    });
  }

  /**
   * Append messages to a conversation
   */
  async appendMessages(conversationId: string, newMessages: Message[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('Supabase not available, messages not persisted');
      return false;
    }

    // Get existing messages
    const { data: existing } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();

    const existingMessages = (existing?.messages as Message[]) || [];
    const updatedMessages = [...existingMessages, ...newMessages];

    const { error } = await supabase
      .from('conversations')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) {
      console.error('Error appending messages:', error);
      return false;
    }

    return true;
  }

  /**
   * List conversations for a user
   */
  async list(options: ListConversationsOptions): Promise<Conversation[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { userId, type, workspaceSessionId, repoFullName, includeArchived, limit = 50 } = options;

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (type) {
      if (Array.isArray(type)) {
        query = query.in('conversation_type', type);
      } else {
        query = query.eq('conversation_type', type);
      }
    }

    if (workspaceSessionId) {
      query = query.eq('workspace_session_id', workspaceSessionId);
    }

    if (repoFullName) {
      query = query.eq('repo_full_name', repoFullName);
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing conversations:', error);
      return [];
    }

    return (data as Conversation[]) || [];
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, title: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating conversation title:', error);
      return false;
    }

    return true;
  }

  /**
   * Archive a conversation
   */
  async archive(conversationId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('Error archiving conversation:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete a conversation permanently
   */
  async delete(conversationId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase.from('conversations').delete().eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete all conversations for a workspace session
   */
  async deleteByWorkspaceSession(workspaceSessionId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('workspace_session_id', workspaceSessionId);

    if (error) {
      console.error('Error deleting conversations by workspace session:', error);
      return false;
    }

    return true;
  }

  /**
   * Extract title from first message
   */
  extractTitle(message: string): string {
    // Take first 50 chars or first sentence, whichever is shorter
    const firstLine = message.split('\n')[0];
    const firstSentence = message.split(/[.!?]/)[0];
    const shorter = firstLine.length < firstSentence.length ? firstLine : firstSentence;
    return shorter.length > 50 ? shorter.substring(0, 47) + '...' : shorter;
  }
}

// Singleton instance
export const conversationService = new ConversationService();
