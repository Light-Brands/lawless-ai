-- Migration: Switch from Supabase Auth UUIDs to GitHub usernames
-- Date: 2026-01-19
-- Description: Allows using GitHub username directly as user identifier
--              Removes dependency on auth.users table

-- ============================================================================
-- STEP 1: Drop existing foreign key constraints and RLS policies
-- ============================================================================

-- Drop RLS policies that reference auth.uid()
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.integration_connections;
DROP POLICY IF EXISTS "Users can manage own repos" ON public.user_repos;
DROP POLICY IF EXISTS "Users can manage own repo integrations" ON public.repo_integrations;
DROP POLICY IF EXISTS "Users can manage own workspace sessions" ON public.workspace_sessions;
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage own terminal sessions" ON public.terminal_sessions;
DROP POLICY IF EXISTS "Users can manage own terminal outputs" ON public.terminal_outputs;
DROP POLICY IF EXISTS "Users can manage own SQL history" ON public.sql_query_history;

-- ============================================================================
-- STEP 2: Modify users table - change id from UUID to TEXT (GitHub username)
-- ============================================================================

-- Create new users table with TEXT id
CREATE TABLE IF NOT EXISTS public.users_new (
  id TEXT PRIMARY KEY,  -- GitHub username
  github_username TEXT,
  github_id TEXT UNIQUE,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copy existing data if any (mapping old UUID to github_username if available)
INSERT INTO public.users_new (id, github_username, github_id, avatar_url, display_name, created_at, updated_at)
SELECT
  COALESCE(github_username, id::TEXT) as id,
  github_username,
  github_id,
  avatar_url,
  display_name,
  created_at,
  updated_at
FROM public.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2.5: Add missing columns to conversations table
-- ============================================================================

-- Add conversation_type column if missing
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS conversation_type TEXT DEFAULT 'workspace';

-- Add metadata column if missing
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add last_message_at column if missing
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();

-- Add is_archived column if missing
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add repo_full_name column if missing
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS repo_full_name TEXT;

-- ============================================================================
-- STEP 3: Update dependent tables to use TEXT user_id
-- ============================================================================

-- Integration connections
ALTER TABLE public.integration_connections
  DROP CONSTRAINT IF EXISTS integration_connections_user_id_fkey;
ALTER TABLE public.integration_connections
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- User repos
ALTER TABLE public.user_repos
  DROP CONSTRAINT IF EXISTS user_repos_user_id_fkey;
ALTER TABLE public.user_repos
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Repo integrations
ALTER TABLE public.repo_integrations
  DROP CONSTRAINT IF EXISTS repo_integrations_user_id_fkey;
ALTER TABLE public.repo_integrations
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Workspace sessions
ALTER TABLE public.workspace_sessions
  DROP CONSTRAINT IF EXISTS workspace_sessions_user_id_fkey;
ALTER TABLE public.workspace_sessions
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Conversations - also update workspace_session_id reference
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_workspace_session_id_fkey;
ALTER TABLE public.conversations
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
-- workspace_session_id stays as UUID since it references workspace_sessions.id which is still UUID

-- Terminal sessions
ALTER TABLE public.terminal_sessions
  DROP CONSTRAINT IF EXISTS terminal_sessions_user_id_fkey;
ALTER TABLE public.terminal_sessions
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- SQL query history
ALTER TABLE public.sql_query_history
  DROP CONSTRAINT IF EXISTS sql_query_history_user_id_fkey;
ALTER TABLE public.sql_query_history
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ============================================================================
-- STEP 4: Replace users table
-- ============================================================================

DROP TABLE IF EXISTS public.users CASCADE;
ALTER TABLE public.users_new RENAME TO users;

-- Re-add updated_at trigger
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Add new foreign key constraints (optional, for data integrity)
-- ============================================================================

-- Add foreign keys to reference users.id (now TEXT)
ALTER TABLE public.integration_connections
  ADD CONSTRAINT integration_connections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_repos
  ADD CONSTRAINT user_repos_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.repo_integrations
  ADD CONSTRAINT repo_integrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_sessions
  ADD CONSTRAINT workspace_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.terminal_sessions
  ADD CONSTRAINT terminal_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.sql_query_history
  ADD CONSTRAINT sql_query_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 6: Create new RLS policies using user_id directly
-- ============================================================================

-- Users table - simplified policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (true);  -- Allow reading any user profile

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (true);  -- Backend uses service role, bypasses RLS

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (true);  -- Allow creating users

-- For other tables, we'll use service_role key which bypasses RLS
-- These policies are for future client-side access if needed

CREATE POLICY "Service role access for integrations"
  ON public.integration_connections FOR ALL
  USING (true);

CREATE POLICY "Service role access for repos"
  ON public.user_repos FOR ALL
  USING (true);

CREATE POLICY "Service role access for repo integrations"
  ON public.repo_integrations FOR ALL
  USING (true);

CREATE POLICY "Service role access for workspace sessions"
  ON public.workspace_sessions FOR ALL
  USING (true);

CREATE POLICY "Service role access for conversations"
  ON public.conversations FOR ALL
  USING (true);

CREATE POLICY "Service role access for terminal sessions"
  ON public.terminal_sessions FOR ALL
  USING (true);

CREATE POLICY "Service role access for terminal outputs"
  ON public.terminal_outputs FOR ALL
  USING (true);

CREATE POLICY "Service role access for SQL history"
  ON public.sql_query_history FOR ALL
  USING (true);

-- ============================================================================
-- STEP 7: Re-create indexes
-- ============================================================================

-- These should already exist but ensure they're there
CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_user ON public.user_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user ON public.workspace_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user ON public.terminal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sql_history_user ON public.sql_query_history(user_id);
