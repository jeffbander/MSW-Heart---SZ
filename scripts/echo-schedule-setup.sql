-- ============================================
-- ECHO LAB SCHEDULE DATABASE SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. ECHO TECHS TABLE
CREATE TABLE IF NOT EXISTS echo_techs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initials TEXT UNIQUE NOT NULL,
  capacity_per_half_day INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echo_techs_initials ON echo_techs(initials);
CREATE INDEX IF NOT EXISTS idx_echo_techs_active ON echo_techs(is_active);

-- 2. ECHO ROOMS TABLE
CREATE TABLE IF NOT EXISTS echo_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- 'CVI' or 'Fourth Floor Lab'
  name TEXT NOT NULL,
  short_name TEXT,  -- Optional nickname
  capacity_type TEXT,  -- 'vascular', 'echo', 'stress_echo', or NULL
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echo_rooms_category ON echo_rooms(category);
CREATE INDEX IF NOT EXISTS idx_echo_rooms_order ON echo_rooms(display_order);

-- 3. ECHO SCHEDULE ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS echo_schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  echo_room_id UUID REFERENCES echo_rooms(id) ON DELETE CASCADE,
  echo_tech_id UUID REFERENCES echo_techs(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, echo_room_id, time_block, echo_tech_id)
);

CREATE INDEX IF NOT EXISTS idx_echo_schedule_date ON echo_schedule_assignments(date);
CREATE INDEX IF NOT EXISTS idx_echo_schedule_room ON echo_schedule_assignments(echo_room_id);
CREATE INDEX IF NOT EXISTS idx_echo_schedule_tech ON echo_schedule_assignments(echo_tech_id);

-- 4. ECHO PTO TABLE
CREATE TABLE IF NOT EXISTS echo_pto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  echo_tech_id UUID REFERENCES echo_techs(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM', 'BOTH')),
  reason TEXT,  -- 'off', 'sick', 'vacation', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, echo_tech_id, time_block)
);

CREATE INDEX IF NOT EXISTS idx_echo_pto_date ON echo_pto(date);
CREATE INDEX IF NOT EXISTS idx_echo_pto_tech ON echo_pto(echo_tech_id);

-- ============================================
-- SEED DATA - ECHO TECHS
-- ============================================
INSERT INTO echo_techs (name, initials, capacity_per_half_day) VALUES
  ('Nancy', 'Nancy', 5),
  ('Lisa', 'Lisa', 5),
  ('Linda', 'Linda', 5),
  ('Anna', 'Anna', 5),
  ('Karina', 'Karina', 5),
  ('Wendy', 'Wendy', 5),
  ('Tomy', 'Tomy', 5),
  ('Ewa', 'Ewa', 5),
  ('Sonal', 'Sonal', 5),
  ('Sukhjeet', 'Sukhjeet', 5),
  ('Wen', 'Wen', 5)
ON CONFLICT (initials) DO NOTHING;

-- ============================================
-- SEED DATA - ECHO ROOMS
-- ============================================

-- CVI Rooms
INSERT INTO echo_rooms (category, name, short_name, capacity_type, display_order) VALUES
  ('CVI', 'Procedure Room 2 GB-62', 'Stress Echo Room', 'stress_echo', 1),
  ('CVI', 'Procedure Room 5 GB-64', 'Linda''s Room', 'echo', 2),
  ('CVI', 'Procedure Room 6 GB-66', 'Lisa/Nancy Room', 'echo', 3),
  ('CVI', 'Procedure Room 3 GB-65', 'Anna/Karina Room', 'echo', 4),
  ('CVI', 'Procedure Room 7 & GB-68', 'Wendy Vascular Room', 'vascular', 5),
  ('CVI', 'Procedure Room 8 GB-68', 'Vascular/EP/echo', 'vascular', 6)
ON CONFLICT DO NOTHING;

-- Fourth Floor Lab Rooms
INSERT INTO echo_rooms (category, name, short_name, capacity_type, display_order) VALUES
  ('Fourth Floor Lab', 'Room 4A-65 E', 'Room 1', 'echo', 7),
  ('Fourth Floor Lab', 'Room 4A-65D', 'TEE Room', NULL, 8),
  ('Fourth Floor Lab', 'Room 4A-65C', 'Stress Echo Room', 'stress_echo', 9),
  ('Fourth Floor Lab', 'Room 4A-65B', 'Room 4', 'echo', 10),
  ('Fourth Floor Lab', 'Portables', NULL, 'echo', 11),
  ('Fourth Floor Lab', 'Holding Area', NULL, NULL, 12)
ON CONFLICT DO NOTHING;

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE echo_techs ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE echo_pto ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth)
CREATE POLICY "Allow all echo_techs" ON echo_techs FOR ALL USING (true);
CREATE POLICY "Allow all echo_rooms" ON echo_rooms FOR ALL USING (true);
CREATE POLICY "Allow all echo_schedule_assignments" ON echo_schedule_assignments FOR ALL USING (true);
CREATE POLICY "Allow all echo_pto" ON echo_pto FOR ALL USING (true);
