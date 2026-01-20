export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Conversation type discriminator
// 'root' - General chat not tied to a workspace
// 'workspace' - Chat tied to a workspace session (repo-bound)
// 'direct' - Claude workspace sidebar sessions
export type ConversationType = 'root' | 'workspace' | 'direct';

// Activity event type discriminator
export type ActivityEventType = 'claude' | 'user' | 'git' | 'deployment' | 'database' | 'system' | 'terminal' | 'service';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          github_username: string | null;
          github_id: string | null;
          avatar_url: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          github_username?: string | null;
          github_id?: string | null;
          avatar_url?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          github_username?: string | null;
          github_id?: string | null;
          avatar_url?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      integration_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_repos: {
        Row: {
          id: string;
          user_id: string;
          repo_id: number;
          repo_full_name: string;
          repo_name: string;
          is_private: boolean;
          description: string | null;
          language: string | null;
          default_branch: string;
          html_url: string | null;
          clone_url: string | null;
          is_favorite: boolean;
          last_accessed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_id: number;
          repo_full_name: string;
          repo_name: string;
          is_private?: boolean;
          description?: string | null;
          language?: string | null;
          default_branch?: string;
          html_url?: string | null;
          clone_url?: string | null;
          is_favorite?: boolean;
          last_accessed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          repo_id?: number;
          repo_full_name?: string;
          repo_name?: string;
          is_private?: boolean;
          description?: string | null;
          language?: string | null;
          default_branch?: string;
          html_url?: string | null;
          clone_url?: string | null;
          is_favorite?: boolean;
          last_accessed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      repo_integrations: {
        Row: {
          id: string;
          user_id: string;
          repo_full_name: string;
          vercel_project_id: string | null;
          supabase_project_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_full_name: string;
          vercel_project_id?: string | null;
          supabase_project_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          repo_full_name?: string;
          vercel_project_id?: string | null;
          supabase_project_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspace_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          repo_full_name: string;
          name: string;
          branch_name: string;
          base_branch: string;
          base_commit: string | null;
          created_at: string;
          last_accessed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          repo_full_name: string;
          name: string;
          branch_name: string;
          base_branch?: string;
          base_commit?: string | null;
          created_at?: string;
          last_accessed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          repo_full_name?: string;
          name?: string;
          branch_name?: string;
          base_branch?: string;
          base_commit?: string | null;
          created_at?: string;
          last_accessed_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          workspace_session_id: string | null;
          conversation_type: ConversationType;
          repo_full_name: string | null;
          messages: Json;
          metadata: Json;
          title: string | null;
          last_message_at: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_session_id?: string | null;
          conversation_type?: ConversationType;
          repo_full_name?: string | null;
          messages?: Json;
          metadata?: Json;
          title?: string | null;
          last_message_at?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workspace_session_id?: string | null;
          conversation_type?: ConversationType;
          repo_full_name?: string | null;
          messages?: Json;
          metadata?: Json;
          title?: string | null;
          last_message_at?: string;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      terminal_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          repo_full_name: string;
          name: string;
          branch_name: string | null;
          base_branch: string;
          base_commit: string | null;
          created_at: string;
          last_accessed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          repo_full_name: string;
          name: string;
          branch_name?: string | null;
          base_branch?: string;
          base_commit?: string | null;
          created_at?: string;
          last_accessed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          repo_full_name?: string;
          name?: string;
          branch_name?: string | null;
          base_branch?: string;
          base_commit?: string | null;
          created_at?: string;
          last_accessed_at?: string;
        };
      };
      terminal_outputs: {
        Row: {
          id: string;
          terminal_session_id: string;
          tab_id: string | null;
          output_lines: string[] | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          terminal_session_id: string;
          tab_id?: string | null;
          output_lines?: string[] | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          terminal_session_id?: string;
          tab_id?: string | null;
          output_lines?: string[] | null;
          updated_at?: string;
        };
      };
      terminal_tabs: {
        Row: {
          id: string;
          terminal_session_id: string;
          tab_id: string;
          name: string;
          tab_index: number;
          worktree_path: string;
          branch_name: string;
          base_branch: string;
          created_at: string;
          last_focused_at: string;
        };
        Insert: {
          id?: string;
          terminal_session_id: string;
          tab_id: string;
          name?: string;
          tab_index?: number;
          worktree_path: string;
          branch_name: string;
          base_branch?: string;
          created_at?: string;
          last_focused_at?: string;
        };
        Update: {
          id?: string;
          terminal_session_id?: string;
          tab_id?: string;
          name?: string;
          tab_index?: number;
          worktree_path?: string;
          branch_name?: string;
          base_branch?: string;
          created_at?: string;
          last_focused_at?: string;
        };
      };
      sql_query_history: {
        Row: {
          id: string;
          user_id: string;
          project_ref: string;
          query: string;
          success: boolean;
          row_count: number | null;
          execution_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_ref: string;
          query: string;
          success: boolean;
          row_count?: number | null;
          execution_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_ref?: string;
          query?: string;
          success?: boolean;
          row_count?: number | null;
          execution_time_ms?: number | null;
          created_at?: string;
        };
      };
      activity_events: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          repo_full_name: string | null;
          event_type: ActivityEventType;
          icon: string;
          summary: string;
          details: string | null;
          related_file: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          repo_full_name?: string | null;
          event_type: ActivityEventType;
          icon: string;
          summary: string;
          details?: string | null;
          related_file?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          repo_full_name?: string | null;
          event_type?: ActivityEventType;
          icon?: string;
          summary?: string;
          details?: string | null;
          related_file?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for common operations
export type User = Database['public']['Tables']['users']['Row'];
export type IntegrationConnection = Database['public']['Tables']['integration_connections']['Row'];
export type UserRepo = Database['public']['Tables']['user_repos']['Row'];
export type RepoIntegration = Database['public']['Tables']['repo_integrations']['Row'];
export type WorkspaceSession = Database['public']['Tables']['workspace_sessions']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];
export type TerminalSession = Database['public']['Tables']['terminal_sessions']['Row'];
export type TerminalOutput = Database['public']['Tables']['terminal_outputs']['Row'];
export type TerminalTab = Database['public']['Tables']['terminal_tabs']['Row'];
export type TerminalTabInsert = Database['public']['Tables']['terminal_tabs']['Insert'];
export type SqlQueryHistory = Database['public']['Tables']['sql_query_history']['Row'];
export type ActivityEvent = Database['public']['Tables']['activity_events']['Row'];
export type ActivityEventInsert = Database['public']['Tables']['activity_events']['Insert'];

// Message types for conversation messages array
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: {
    toolUse?: boolean;
    thinking?: boolean;
    [key: string]: unknown;
  };
}

// Metadata types for different conversation contexts
export interface WorkspaceConversationMetadata {
  repoFullName?: string;
  branchName?: string;
  sessionName?: string;
}

export interface RootConversationMetadata {
  source?: string;
  context?: string;
}

export interface DirectConversationMetadata {
  claudeSessionId?: string;
  localStorageKey?: string;
}
