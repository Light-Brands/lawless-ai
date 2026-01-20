-- Activity Events Table
-- Stores IDE activity logs for persistence and audit trail

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT, -- IDE session ID (optional)
  repo_full_name TEXT, -- Repository context (optional)

  -- Event details
  event_type TEXT NOT NULL, -- 'claude', 'user', 'git', 'deployment', 'database', 'system', 'terminal', 'service'
  icon TEXT NOT NULL, -- Emoji icon for display
  summary TEXT NOT NULL, -- Human-readable summary
  details TEXT, -- Additional details
  related_file TEXT, -- File path if relevant

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Extensible metadata

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_event_type CHECK (event_type IN ('claude', 'user', 'git', 'deployment', 'database', 'system', 'terminal', 'service'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_repo ON activity_events(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy (service role bypasses, anon users need explicit policy)
CREATE POLICY "Users can view their own activity events" ON activity_events
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage activity events" ON activity_events
  FOR ALL USING (true);

-- Enable realtime for live activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;

-- Comment on table
COMMENT ON TABLE activity_events IS 'IDE activity log for persistence and audit trail';
