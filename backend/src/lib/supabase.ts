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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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

/**
 * Ensure a user exists in the database
 * Creates the user record if it doesn't exist (using GitHub username as ID)
 */
export async function ensureUserExists(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return false;
  }

  try {
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) {
      return true;
    }

    // Create user record
    const { error } = await supabase
      .from('users')
      .insert({
        id: userId,
        github_username: userId,
        display_name: userId,
      });

    if (error) {
      // Ignore duplicate key errors (race condition)
      if (error.code === '23505') {
        return true;
      }
      console.error('Error creating user:', error);
      return false;
    }

    console.log(`Created user record for: ${userId}`);
    return true;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    return false;
  }
}
