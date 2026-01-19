import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types for backend (mirrors frontend types)
export type ConversationType = 'root' | 'workspace' | 'direct';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  user_id: string;
  workspace_session_id: string | null;
  conversation_type: ConversationType;
  repo_full_name: string | null;
  messages: Message[];
  metadata: Record<string, unknown>;
  title: string | null;
  last_message_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationInsert {
  user_id: string;
  workspace_session_id?: string | null;
  conversation_type?: ConversationType;
  repo_full_name?: string | null;
  messages?: Message[];
  metadata?: Record<string, unknown>;
  title?: string | null;
}

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 * Returns null if Supabase is not configured
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase not configured - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Supabase client initialized for backend');
  return supabaseClient;
}

/**
 * Check if Supabase is available
 */
export function isSupabaseAvailable(): boolean {
  return getSupabaseClient() !== null;
}
