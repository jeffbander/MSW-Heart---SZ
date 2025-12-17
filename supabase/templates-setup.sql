-- Schedule Templates Tables
-- Run this SQL in your Supabase SQL Editor to add template support

-- Table for storing template metadata
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'weekly' CHECK (type IN ('weekly', 'provider-leave', 'custom')),
  is_global BOOLEAN DEFAULT TRUE,
  owner_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table for storing template assignments (day-of-week based)
CREATE TABLE IF NOT EXISTS template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM', 'BOTH')),
  room_count INTEGER DEFAULT 0,
  is_pto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_schedule_templates_type ON schedule_templates(type);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_owner ON schedule_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_global ON schedule_templates(is_global);
CREATE INDEX IF NOT EXISTS idx_template_assignments_template ON template_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_assignments_day ON template_assignments(day_of_week);

-- Enable RLS (Row Level Security)
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth setup)
CREATE POLICY "Allow all access to schedule_templates" ON schedule_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to template_assignments" ON template_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_schedule_templates_updated_at ON schedule_templates;
CREATE TRIGGER update_schedule_templates_updated_at
  BEFORE UPDATE ON schedule_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
