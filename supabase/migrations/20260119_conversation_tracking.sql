-- Migration: Add conversation tracking enhancements
-- Date: 2026-01-19
-- Description: Adds conversation_type, metadata, and tracking fields for unified chat tracking

-- Add conversation_type to distinguish between different chat contexts
-- Types: 'root' (general chat), 'workspace' (repo-bound), 'direct' (Claude workspace sidebar)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS conversation_type TEXT DEFAULT 'workspace';

-- Add metadata for context-specific data (repo info, session context, etc.)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add last_message_at for efficient sorting and session restoration
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();

-- Add is_archived for soft-delete functionality
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add repo_full_name for root/direct chats that aren't tied to workspace sessions
-- This allows conversations to be associated with a repo without requiring a workspace session
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS repo_full_name TEXT;

-- Create index for efficient filtering by conversation type
CREATE INDEX IF NOT EXISTS idx_conversations_type
ON public.conversations(user_id, conversation_type);

-- Create index for sorting by last message time
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
ON public.conversations(user_id, last_message_at DESC);

-- Create index for filtering non-archived conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active
ON public.conversations(user_id, is_archived, last_message_at DESC);

-- Create index for repo-based lookups (for root/direct chats)
CREATE INDEX IF NOT EXISTS idx_conversations_repo
ON public.conversations(user_id, repo_full_name);

-- Create function to auto-update last_message_at when messages change
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if messages array changed
  IF NEW.messages IS DISTINCT FROM OLD.messages THEN
    NEW.last_message_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating last_message_at
DROP TRIGGER IF EXISTS update_conversations_last_message_at ON public.conversations;
CREATE TRIGGER update_conversations_last_message_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();

-- Backfill existing conversations: set last_message_at to updated_at
UPDATE public.conversations
SET last_message_at = updated_at
WHERE last_message_at IS NULL OR last_message_at = created_at;

-- Backfill conversation_type for existing workspace-linked conversations
UPDATE public.conversations
SET conversation_type = 'workspace'
WHERE workspace_session_id IS NOT NULL AND conversation_type IS NULL;
