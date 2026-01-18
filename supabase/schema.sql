-- Lawless AI Cloud Persistence Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT UNIQUE,
  github_id TEXT UNIQUE,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration connections (GitHub, Vercel tokens)
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'github', 'vercel', 'supabase_pat'
  access_token TEXT, -- encrypted
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Repo integrations (Vercel/Supabase project mappings)
CREATE TABLE IF NOT EXISTS public.repo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  vercel_project_id TEXT,
  supabase_project_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
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
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_session_id UUID REFERENCES public.workspace_sessions(id) ON DELETE SET NULL,
  messages JSONB DEFAULT '[]',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terminal sessions
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  output_lines TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(terminal_session_id)
);

-- SQL query history
CREATE TABLE IF NOT EXISTS public.sql_query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_ref TEXT NOT NULL,
  query TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  row_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_repo_integrations_user ON public.repo_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user ON public.workspace_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_repo ON public.workspace_sessions(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user ON public.terminal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_repo ON public.terminal_sessions(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_sql_history_user ON public.sql_query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sql_history_project ON public.sql_query_history(project_ref);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for integration_connections
CREATE POLICY "Users can manage own integrations"
  ON public.integration_connections FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for repo_integrations
CREATE POLICY "Users can manage own repo integrations"
  ON public.repo_integrations FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for workspace_sessions
CREATE POLICY "Users can manage own workspace sessions"
  ON public.workspace_sessions FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can manage own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for terminal_sessions
CREATE POLICY "Users can manage own terminal sessions"
  ON public.terminal_sessions FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for terminal_outputs (via terminal_sessions)
CREATE POLICY "Users can manage own terminal outputs"
  ON public.terminal_outputs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.terminal_sessions
      WHERE id = terminal_session_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for sql_query_history
CREATE POLICY "Users can manage own SQL history"
  ON public.sql_query_history FOR ALL
  USING (auth.uid() = user_id);

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

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terminal_outputs_updated_at
  BEFORE UPDATE ON public.terminal_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_sessions;
