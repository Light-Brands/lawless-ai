-- IDE Migration History
-- Tracks migrations run through the Lawless IDE interface

CREATE TABLE IF NOT EXISTS public.ide_migration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Migration identification
  migration_version text NOT NULL,
  migration_name text NOT NULL,
  migration_path text,

  -- Project context
  project_ref text NOT NULL,
  owner text NOT NULL,
  repo text NOT NULL,

  -- Execution details
  executed_by uuid REFERENCES auth.users(id),
  executed_at timestamptz DEFAULT now(),

  -- Result tracking
  success boolean NOT NULL DEFAULT false,
  error_message text,
  error_code text,

  -- Additional metadata
  execution_time_ms integer,
  sql_hash text,

  UNIQUE(project_ref, migration_version)
);

-- Index for querying by project
CREATE INDEX IF NOT EXISTS idx_ide_migration_history_project
  ON public.ide_migration_history(project_ref, migration_version);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_ide_migration_history_user
  ON public.ide_migration_history(executed_by);

-- Enable RLS
ALTER TABLE public.ide_migration_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view migration history for projects they have access to
-- (For now, allow authenticated users to view all - can be restricted later based on project access)
CREATE POLICY "Users can view migration history"
  ON public.ide_migration_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can insert their own migration runs
CREATE POLICY "Users can record their migration runs"
  ON public.ide_migration_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = executed_by);

-- Grant permissions
GRANT SELECT, INSERT ON public.ide_migration_history TO authenticated;
