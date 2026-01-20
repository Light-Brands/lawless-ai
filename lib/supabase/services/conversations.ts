import type {
  Conversation,
  ConversationInsert,
  ConversationType,
  Json,
} from '@/types/database';

// Use generic client type to support both regular and service clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export interface ListConversationsOptions {
  type?: ConversationType | ConversationType[];
  workspaceSessionId?: string;
  repoFullName?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateConversationOptions {
  userId: string;
  type?: ConversationType;
  workspaceSessionId?: string;
  repoFullName?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export async function createConversation(
  supabase: SupabaseClient,
  options: CreateConversationOptions
): Promise<Conversation | null>;
export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  workspaceSessionId?: string,
  title?: string
): Promise<Conversation | null>;
export async function createConversation(
  supabase: SupabaseClient,
  userIdOrOptions: string | CreateConversationOptions,
  workspaceSessionId?: string,
  title?: string
): Promise<Conversation | null> {
  // Handle both old and new signatures
  const options: CreateConversationOptions =
    typeof userIdOrOptions === 'string'
      ? {
          userId: userIdOrOptions,
          workspaceSessionId,
          title,
          type: workspaceSessionId ? 'workspace' : 'root',
        }
      : userIdOrOptions;

  const insertData: ConversationInsert = {
    user_id: options.userId,
    conversation_type: options.type || (options.workspaceSessionId ? 'workspace' : 'root'),
    workspace_session_id: options.workspaceSessionId,
    repo_full_name: options.repoFullName,
    title: options.title,
    metadata: (options.metadata || {}) as Json,
    messages: [],
  };

  const { data, error } = await supabase
    .from('conversations')
    .insert(insertData as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data as Conversation;
}

export async function getConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<Conversation | null> {
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

export async function getConversationByWorkspaceSession(
  supabase: SupabaseClient,
  workspaceSessionId: string
): Promise<Conversation | null> {
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

export async function listConversations(
  supabase: SupabaseClient,
  options?: ListConversationsOptions | string,
  legacyLimit?: number
): Promise<Conversation[]> {
  // Handle legacy signature: listConversations(supabase, workspaceSessionId, limit)
  const opts: ListConversationsOptions =
    typeof options === 'string'
      ? { workspaceSessionId: options, limit: legacyLimit }
      : options || {};

  const { type, workspaceSessionId, repoFullName, includeArchived, limit = 50, offset = 0 } = opts;

  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by conversation type
  if (type) {
    if (Array.isArray(type)) {
      query = query.in('conversation_type', type);
    } else {
      query = query.eq('conversation_type', type);
    }
  }

  // Filter by workspace session
  if (workspaceSessionId) {
    query = query.eq('workspace_session_id', workspaceSessionId);
  }

  // Filter by repo
  if (repoFullName) {
    query = query.eq('repo_full_name', repoFullName);
  }

  // Filter archived
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
 * List conversations by type for a user
 */
export async function listConversationsByType(
  supabase: SupabaseClient,
  userId: string,
  type: ConversationType | ConversationType[],
  options?: Omit<ListConversationsOptions, 'type'>
): Promise<Conversation[]> {
  return listConversations(supabase, { ...options, type });
}

/**
 * Get recent conversations across all types for sidebar display
 */
export async function getRecentConversations(
  supabase: SupabaseClient,
  limit = 20
): Promise<Conversation[]> {
  return listConversations(supabase, { limit, includeArchived: false });
}

export async function appendMessages(
  supabase: SupabaseClient,
  conversationId: string,
  newMessages: Message[]
): Promise<boolean> {
  // First get existing messages
  const { data: existing } = await supabase
    .from('conversations')
    .select('messages')
    .eq('id', conversationId)
    .single();

  const existingMessages = ((existing as Conversation | null)?.messages as Message[]) || [];
  const updatedMessages = [...existingMessages, ...newMessages];

  const { error } = await supabase
    .from('conversations')
    .update({
      messages: updatedMessages as unknown as Json,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', conversationId);

  if (error) {
    console.error('Error appending messages:', error);
    return false;
  }

  return true;
}

export async function updateConversationTitle(
  supabase: SupabaseClient,
  conversationId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() } as never)
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation title:', error);
    return false;
  }

  return true;
}

export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }

  return true;
}

export async function deleteConversationsByWorkspaceSession(
  supabase: SupabaseClient,
  workspaceSessionId: string
): Promise<boolean> {
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
 * Get or create a conversation for a workspace session
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  workspaceSessionId: string,
  repoFullName?: string
): Promise<Conversation | null> {
  // Try to find existing conversation
  const existing = await getConversationByWorkspaceSession(supabase, workspaceSessionId);
  if (existing) {
    return existing;
  }

  // Create new conversation
  return createConversation(supabase, {
    userId,
    type: 'workspace',
    workspaceSessionId,
    repoFullName,
  });
}

/**
 * Archive a conversation (soft delete)
 */
export async function archiveConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .update({ is_archived: true, updated_at: new Date().toISOString() } as never)
    .eq('id', conversationId);

  if (error) {
    console.error('Error archiving conversation:', error);
    return false;
  }

  return true;
}

/**
 * Unarchive a conversation
 */
export async function unarchiveConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .update({ is_archived: false, updated_at: new Date().toISOString() } as never)
    .eq('id', conversationId);

  if (error) {
    console.error('Error unarchiving conversation:', error);
    return false;
  }

  return true;
}

/**
 * Get or create a root conversation (not tied to workspace)
 */
export async function getOrCreateRootConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId?: string
): Promise<Conversation | null> {
  // If ID provided, try to fetch it
  if (conversationId) {
    const existing = await getConversation(supabase, conversationId);
    if (existing) {
      return existing;
    }
  }

  // Create new root conversation
  return createConversation(supabase, {
    userId,
    type: 'root',
  });
}

/**
 * Get or create a direct conversation (Claude workspace sidebar)
 */
export async function getOrCreateDirectConversation(
  supabase: SupabaseClient,
  userId: string,
  localSessionId: string,
  repoFullName?: string
): Promise<Conversation | null> {
  // Try to find by metadata
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('conversation_type', 'direct')
    .eq('metadata->claudeSessionId', localSessionId)
    .single();

  if (data) {
    return data as Conversation;
  }

  // Create new direct conversation
  return createConversation(supabase, {
    userId,
    type: 'direct',
    repoFullName,
    metadata: { claudeSessionId: localSessionId },
  });
}
