-- ============================================
-- ECHO SCHEDULE TEMPLATES DATABASE SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. ECHO SCHEDULE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS echo_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echo_templates_active ON echo_schedule_templates(is_active);

-- 2. ECHO TEMPLATE ASSIGNMENTS TABLE
-- Uses day_of_week (0=Sunday, 6=Saturday) instead of specific dates
CREATE TABLE IF NOT EXISTS echo_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES echo_schedule_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  echo_room_id UUID REFERENCES echo_rooms(id) ON DELETE CASCADE,
  echo_tech_id UUID REFERENCES echo_techs(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(template_id, day_of_week, echo_room_id, time_block, echo_tech_id)
);

CREATE INDEX IF NOT EXISTS idx_echo_template_assignments_template ON echo_template_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_echo_template_assignments_day ON echo_template_assignments(day_of_week);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE echo_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_template_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth)
CREATE POLICY "Allow all echo_schedule_templates" ON echo_schedule_templates FOR ALL USING (true);
CREATE POLICY "Allow all echo_template_assignments" ON echo_template_assignments FOR ALL USING (true);
