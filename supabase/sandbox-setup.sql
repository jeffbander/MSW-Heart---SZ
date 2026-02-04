-- Sandbox Mode Setup
-- Creates tables for experimenting with schedules without affecting live data

-- Sandbox sessions table to track different sandbox experiments
CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled Sandbox',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sandbox assignments - mirrors schedule_assignments structure
CREATE TABLE IF NOT EXISTS sandbox_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_session_id UUID REFERENCES sandbox_sessions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM', 'BOTH')),
  room_count INTEGER DEFAULT 0,
  is_pto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  -- Track if this is a new assignment or modified from live
  source_assignment_id UUID REFERENCES schedule_assignments(id) ON DELETE SET NULL,
  change_type TEXT CHECK (change_type IN ('added', 'modified', 'removed'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sandbox_assignments_session ON sandbox_assignments(sandbox_session_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_assignments_date ON sandbox_assignments(date);
CREATE INDEX IF NOT EXISTS idx_sandbox_assignments_provider ON sandbox_assignments(provider_id);

-- Enable RLS
ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on auth requirements)
CREATE POLICY "Allow all on sandbox_sessions" ON sandbox_sessions FOR ALL USING (true);
CREATE POLICY "Allow all on sandbox_assignments" ON sandbox_assignments FOR ALL USING (true);
