-- Schedule Change History Table
-- Tracks template applications, bulk operations for undo/redo functionality

CREATE TABLE IF NOT EXISTS schedule_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation details
  operation_type TEXT NOT NULL,             -- 'template_apply', 'template_apply_alternating', 'bulk_add', 'bulk_remove'
  operation_description TEXT,               -- Human readable: "Applied 'Week A' to Jan 1-31"

  -- Date range affected
  affected_date_start DATE NOT NULL,
  affected_date_end DATE NOT NULL,

  -- Snapshot data for undo
  deleted_assignments JSONB,                -- Full assignment objects that were deleted (for restore on undo)
  created_assignment_ids UUID[],            -- IDs of assignments that were created (for delete on undo)

  -- For redo after undo
  redo_assignments JSONB,                   -- Assignments to re-create on redo

  -- State tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_undone BOOLEAN DEFAULT FALSE,
  undone_at TIMESTAMP WITH TIME ZONE,
  is_redone BOOLEAN DEFAULT FALSE,
  redone_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB                            -- Additional context (template name, provider info, etc.)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_change_history_created_at ON schedule_change_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_history_date_range ON schedule_change_history(affected_date_start, affected_date_end);
CREATE INDEX IF NOT EXISTS idx_change_history_undone ON schedule_change_history(is_undone);
