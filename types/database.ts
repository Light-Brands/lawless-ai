export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
      repo_integrations: {
        Row: {
          id: string;
          user_id: string;
          repo_full_name: string;
          vercel_project_id: string | null;
          supabase_project_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_full_name: string;
          vercel_project_id?: string | null;
          supabase_project_ref?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          repo_full_name?: string;
          vercel_project_id?: string | null;
          supabase_project_ref?: string | null;
          created_at?: string;
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
          messages: Json;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_session_id?: string | null;
          messages?: Json;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workspace_session_id?: string | null;
          messages?: Json;
          title?: string | null;
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
          output_lines: string[] | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          terminal_session_id: string;
          output_lines?: string[] | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          terminal_session_id?: string;
          output_lines?: string[] | null;
          updated_at?: string;
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
export type RepoIntegration = Database['public']['Tables']['repo_integrations']['Row'];
export type WorkspaceSession = Database['public']['Tables']['workspace_sessions']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type TerminalSession = Database['public']['Tables']['terminal_sessions']['Row'];
export type TerminalOutput = Database['public']['Tables']['terminal_outputs']['Row'];
export type SqlQueryHistory = Database['public']['Tables']['sql_query_history']['Row'];
