-- Lawless AI Cloud Persistence Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (GitHub username as primary key)
-- Note: id is TEXT (GitHub username), not UUID, to simplify application code
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  github_username TEXT UNIQUE,
  github_id TEXT UNIQUE,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_conversation_id UUID,
  last_root_conversation_id UUID,
  preferences JSONB DEFAULT '{}'
);

-- Integration connections (GitHub, Vercel tokens)
-- Note: user_id stores GitHub username (TEXT), not UUID, to match application code
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'github', 'vercel', 'supabase_pat'
  access_token TEXT, -- encrypted
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- User repos (cached repo data and preferences)
-- Note: user_id stores GitHub username (TEXT), not UUID, to match application code
CREATE TABLE IF NOT EXISTS public.user_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  repo_id BIGINT NOT NULL, -- GitHub repo ID
  repo_full_name TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  description TEXT,
  language TEXT,
  default_branch TEXT DEFAULT 'main',
  html_url TEXT,
  clone_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

-- Repo integrations (Vercel/Supabase project mappings)
-- Note: user_id stores GitHub username (TEXT), not UUID, to match application code
CREATE TABLE IF NOT EXISTS public.repo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  vercel_project_id TEXT,
  supabase_project_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_full_name)
);

-- Workspace sessions
CREATE TABLE IF NOT EXISTS public.workspace_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  base_branch TEXT DEFAULT 'main',
  base_commit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Conversations
-- Supports multiple chat contexts: 'root' (general), 'workspace' (repo-bound), 'direct' (Claude sidebar)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_session_id UUID REFERENCES public.workspace_sessions(id) ON DELETE SET NULL,
  conversation_type TEXT DEFAULT 'workspace', -- 'root' | 'workspace' | 'direct'
  repo_full_name TEXT, -- For root/direct chats not tied to workspace sessions
  messages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}', -- Context-specific data
  title TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terminal sessions
-- Note: user_id stores GitHub username (TEXT), not UUID, to match application code
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  name TEXT NOT NULL,
  branch_name TEXT,
  base_branch TEXT DEFAULT 'main',
  base_commit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Terminal outputs
CREATE TABLE IF NOT EXISTS public.terminal_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  tab_id TEXT,
  output_lines TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(terminal_session_id)
);

-- Terminal tabs (each tab has its own isolated git worktree)
CREATE TABLE IF NOT EXISTS public.terminal_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Terminal',
  tab_index INTEGER NOT NULL DEFAULT 0,
  worktree_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  base_branch TEXT DEFAULT 'main',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_focused_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(terminal_session_id, tab_id)
);

-- SQL query history
-- Note: user_id stores GitHub username (TEXT), not UUID, to match application code
CREATE TABLE IF NOT EXISTS public.sql_query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_ref TEXT NOT NULL,
  query TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  row_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_user ON public.user_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_last_accessed ON public.user_repos(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_repo_integrations_user ON public.repo_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user ON public.workspace_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_repo ON public.workspace_sessions(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(user_id, conversation_type);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON public.conversations(user_id, is_archived, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_repo ON public.conversations(user_id, repo_full_name);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user ON public.terminal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_repo ON public.terminal_sessions(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_terminal_tabs_session ON public.terminal_tabs(terminal_session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_tabs_worktree ON public.terminal_tabs(worktree_path);
CREATE INDEX IF NOT EXISTS idx_terminal_outputs_tab ON public.terminal_outputs(terminal_session_id, tab_id);
CREATE INDEX IF NOT EXISTS idx_sql_history_user ON public.sql_query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sql_history_project ON public.sql_query_history(project_ref);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
-- Note: auth.uid() returns UUID, users.id is TEXT, so cast is required
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- RLS Policies for integration_connections
-- user_id is GitHub username (TEXT), so we look it up from users table
CREATE POLICY "Users can manage own integrations"
  ON public.integration_connections FOR ALL
  USING (user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text));

-- RLS Policies for user_repos
-- user_id is GitHub username (TEXT), so we look it up from users table
CREATE POLICY "Users can manage own repos"
  ON public.user_repos FOR ALL
  USING (user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text));

-- RLS Policies for repo_integrations
-- user_id is GitHub username (TEXT), so we look it up from users table
CREATE POLICY "Users can manage own repo integrations"
  ON public.repo_integrations FOR ALL
  USING (user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text));

-- RLS Policies for workspace_sessions
CREATE POLICY "Users can manage own workspace sessions"
  ON public.workspace_sessions FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can manage own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for terminal_sessions
-- user_id is GitHub username (TEXT), so we look it up from users table
CREATE POLICY "Users can manage own terminal sessions"
  ON public.terminal_sessions FOR ALL
  USING (user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text));

-- RLS Policies for terminal_outputs (via terminal_sessions)
CREATE POLICY "Users can manage own terminal outputs"
  ON public.terminal_outputs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.terminal_sessions
      WHERE id = terminal_session_id
        AND user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text)
    )
  );

-- RLS Policies for terminal_tabs (via terminal_sessions)
CREATE POLICY "Users can manage own terminal tabs"
  ON public.terminal_tabs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.terminal_sessions
      WHERE id = terminal_session_id
        AND user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text)
    )
  );

-- RLS Policies for sql_query_history
-- user_id is GitHub username (TEXT), so we look it up from users table
CREATE POLICY "Users can manage own SQL history"
  ON public.sql_query_history FOR ALL
  USING (user_id = (SELECT github_username FROM public.users WHERE id = auth.uid()::text));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_repos_updated_at
  BEFORE UPDATE ON public.user_repos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repo_integrations_updated_at
  BEFORE UPDATE ON public.repo_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update last_message_at when messages change
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.messages IS DISTINCT FROM OLD.messages THEN
    NEW.last_message_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_last_message_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();

CREATE TRIGGER update_terminal_outputs_updated_at
  BEFORE UPDATE ON public.terminal_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_sessions;
