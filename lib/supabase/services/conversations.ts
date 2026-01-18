import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Conversation, Json } from '@/types/database';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export async function createConversation(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceSessionId?: string,
  title?: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      workspace_session_id: workspaceSessionId,
      title,
      messages: [],
    } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data as Conversation;
}

export async function getConversation(
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
  workspaceSessionId?: string,
  limit = 50
): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (workspaceSessionId) {
    query = query.eq('workspace_session_id', workspaceSessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing conversations:', error);
    return [];
  }

  return (data as Conversation[]) || [];
}

export async function appendMessages(
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceSessionId: string
): Promise<Conversation | null> {
  // Try to find existing conversation
  const existing = await getConversationByWorkspaceSession(supabase, workspaceSessionId);
  if (existing) {
    return existing;
  }

  // Create new conversation
  return createConversation(supabase, userId, workspaceSessionId);
}
