-- ============================================
-- Cardiology Scheduler Database Setup
-- ============================================

-- Drop existing tables (if you need to reset)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS providers CASCADE;

-- ============================================
-- PROVIDERS TABLE
-- ============================================
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initials VARCHAR(10) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  credentials VARCHAR(50),
  allotted_rooms INTEGER DEFAULT 0,
  capabilities TEXT[], -- Array of capabilities
  clinic_days VARCHAR(255), -- e.g., "M-W" or "T (PM)"
  email VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_providers_initials ON providers(initials);
CREATE INDEX idx_providers_active ON providers(is_active);

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(50) NOT NULL UNIQUE,
  room_name VARCHAR(255),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SCHEDULES TABLE
-- ============================================
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  schedule_type VARCHAR(50), -- e.g., "clinic", "procedure", "admin"
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_schedules_provider ON schedules(provider_id);
CREATE INDEX idx_schedules_date ON schedules(schedule_date);
CREATE INDEX idx_schedules_room ON schedules(room_id);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  patient_mrn VARCHAR(50), -- Medical Record Number
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  appointment_type VARCHAR(100), -- e.g., "New Patient", "Follow-up", "Echo"
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no-show
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_appointments_provider ON appointments(provider_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_schedule ON appointments(schedule_id);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- ============================================
-- Uncomment these if you want to enable RLS later
-- ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SAMPLE ROOMS (Optional starter data)
-- ============================================
INSERT INTO rooms (room_number, room_name, location) VALUES
  ('R101', 'Exam Room 1', 'Main Clinic'),
  ('R102', 'Exam Room 2', 'Main Clinic'),
  ('R103', 'Exam Room 3', 'Main Clinic'),
  ('R104', 'Exam Room 4', 'Main Clinic'),
  ('R105', 'Exam Room 5', 'Main Clinic'),
  ('P201', 'Procedure Room 1', 'Procedure Suite'),
  ('P202', 'Procedure Room 2', 'Procedure Suite'),
  ('ECHO1', 'Echo Lab 1', 'Diagnostics'),
  ('ECHO2', 'Echo Lab 2', 'Diagnostics'),
  ('STRESS1', 'Stress Lab', 'Diagnostics');

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
SELECT 'Database setup complete! Tables created: providers, rooms, schedules, appointments' AS status;
