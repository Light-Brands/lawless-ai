-- Migration: Add user preferences for session persistence
-- Date: 2026-01-19
-- Description: Adds columns to store user preferences that were previously in localStorage

-- ============================================================================
-- STEP 1: Add preference columns to users table
-- ============================================================================

-- Last active conversation (for session restoration)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_conversation_id UUID;

-- Last root conversation (for root chat session restoration)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_root_conversation_id UUID;

-- General preferences JSONB (for extensibility)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- ============================================================================
-- STEP 2: Create index for preferences queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_last_conversation ON public.users(last_conversation_id);

-- ============================================================================
-- STEP 3: Add foreign key constraint for conversation references
-- ============================================================================

-- Note: These are soft references - we don't CASCADE delete because
-- we want to keep the user even if their last conversation is deleted
-- The app should handle null/invalid conversation IDs gracefully
