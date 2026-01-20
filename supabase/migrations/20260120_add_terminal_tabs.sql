-- Terminal tabs table with worktree isolation
-- Each terminal tab has its own git worktree, allowing independent branch work

CREATE TABLE IF NOT EXISTS public.terminal_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Terminal',
  tab_index INTEGER NOT NULL DEFAULT 0,

  -- Worktree isolation fields
  worktree_path TEXT NOT NULL,           -- Full path to worktree directory
  branch_name TEXT NOT NULL,             -- Git branch for this tab
  base_branch TEXT DEFAULT 'main',       -- Branch this was created from

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_focused_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(terminal_session_id, tab_id)
);

-- Add tab_id to terminal_outputs for per-tab output tracking
ALTER TABLE public.terminal_outputs ADD COLUMN IF NOT EXISTS tab_id TEXT;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_terminal_tabs_session ON public.terminal_tabs(terminal_session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_outputs_tab ON public.terminal_outputs(terminal_session_id, tab_id);
CREATE INDEX IF NOT EXISTS idx_terminal_tabs_worktree ON public.terminal_tabs(worktree_path);

-- Enable Row Level Security
ALTER TABLE public.terminal_tabs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for terminal_tabs (users can access tabs of their terminal sessions)
CREATE POLICY "Users can manage own terminal tabs"
  ON public.terminal_tabs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.terminal_sessions ts
      WHERE ts.id = terminal_session_id
      AND ts.user_id = auth.uid()::text
    )
  );

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_tabs;
