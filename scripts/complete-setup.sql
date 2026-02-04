-- ============================================
-- Cardiology Scheduler - Complete Database Setup
-- ============================================
-- This script creates tables and inserts all initial data

-- Drop existing tables if they exist
DROP TABLE IF EXISTS schedule_assignments CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS providers CASCADE;

-- ============================================
-- STEP 1: CREATE TABLES
-- ============================================

-- 1. PROVIDERS TABLE
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initials TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  default_room_count INTEGER NOT NULL DEFAULT 0,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. SERVICES TABLE
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  time_block TEXT NOT NULL,
  requires_rooms BOOLEAN NOT NULL DEFAULT FALSE,
  required_capability TEXT,
  show_on_main_calendar BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. SCHEDULE ASSIGNMENTS TABLE
CREATE TABLE schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL,
  room_count INTEGER DEFAULT 0,
  is_pto BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, service_id, time_block)
);

-- Create indexes on schedule_assignments
CREATE INDEX idx_schedule_assignments_date ON schedule_assignments(date);
CREATE INDEX idx_schedule_assignments_provider ON schedule_assignments(provider_id);
CREATE INDEX idx_schedule_assignments_service ON schedule_assignments(service_id);

-- ============================================
-- STEP 2: INSERT PROVIDERS (32 total)
-- ============================================

INSERT INTO providers (name, initials, role, default_room_count, capabilities) VALUES
('Jefrey Bander', 'JB', 'attending', 3, '{"Inpatient", "Rooms", "Admin", "Precepting", "Offsites", "PTO"}'),
('Joshua Shatzkes', 'JS', 'attending', 3, '{"Rooms", "Admin", "Offsites", "Stress Echo", "Nuclear Stress", "PTO"}'),
('Judith Goldfinger', 'JG', 'attending', 3, '{"Rooms", "Admin", "Offsites", "Vascular", "PTO"}'),
('Robert Kornberg', 'RK', 'attending', 2, '{"Inpatient", "Rooms", "Admin", "Precepting", "Offsites", "Nuclear Stress", "PTO"}'),
('Nenad Trubelja', 'NT', 'attending', 2, '{"Inpatient", "Rooms", "Admin", "Offsites", "Nuclear", "Nuclear Stress", "PTO"}'),
('Kiruthika Balasundaram', 'KB', 'attending', 2, '{"Rooms", "Admin", "Offsites", "Nuclear", "Nuclear Stress", "Precepting", "Video Visits", "PTO"}'),
('Krystal Engstrom', 'KE', 'attending', 2, '{"Inpatient", "Fourth Floor Echo Lab", "Echo TTE", "Stress Echo", "Nuclear", "Nuclear Stress", "Rooms", "Precepting", "Offsites", "Admin", "PTO"}'),
('Paul Leis', 'PL', 'attending', 2, '{"Inpatient", "Echo TTE", "Stress Echo", "Nuclear", "Nuclear Stress", "Rooms", "Precepting", "Offsites", "Video Visits", "Admin", "PTO"}'),
('Jared Leventhal', 'JL', 'attending', 2, '{"Inpatient", "Fourth Floor Echo Lab", "Echo TTE", "Stress Echo", "Nuclear", "Nuclear Stress", "Rooms", "Precepting", "Offsites", "Admin", "PTO"}'),
('Nina Kukar', 'NK', 'attending', 2, '{"Fourth Floor Echo Lab", "Echo TTE", "Stress Echo", "Nuclear Stress", "Rooms", "Offsites", "CMR", "Admin", "PTO"}'),
('Hunaina Shahab', 'HS', 'attending', 2, '{"CT", "Rooms", "Admin", "Offsites", "PTO"}'),
('Asaf Rabinovitz', 'AR', 'attending', 2, '{"Fourth Floor Echo Lab", "Echo TTE", "Stress Echo", "Nuclear Stress", "Rooms", "Admin", "Offsites", "PTO"}'),
('Patrick Lam', 'Lam', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Robert Leber', 'RL', 'attending', 2, '{"Rooms", "Offsites", "Precepting", "PTO"}'),
('Waqas Malick', 'WM', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Johanna Contreras', 'Con', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Raman Sharma', 'RS', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Davendra Mehta', 'DM', 'attending', 3, '{"Rooms", "Offsites", "PTO"}'),
('Matthew Tomey', 'MT', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Daniel Pugliese', 'DP', 'attending', 2, '{"Rooms", "Offsites", "PTO"}'),
('Omar Al Dhaybi', 'OD', 'attending', 1, '{"Rooms", "Offsites", "PTO"}'),
('Swaminatha Gurudevan', 'GS', 'attending', 0, '{"Inpatient", "Fourth Floor Echo Lab", "Echo TTE", "Stress Echo", "Nuclear", "Nuclear Stress", "Rooms", "Precepting", "Offsites", "Admin", "PTO"}'),
('Vahid Namdarizandi', 'VN', 'attending', 0, '{"Inpatient", "PTO"}'),
('Susan Colpoys', 'SC', 'attending', 2, '{"Rooms", "Admin", "Provider Support", "PTO"}'),
('Victoria Kazickas', 'VK', 'attending', 2, '{"Rooms", "Admin", "Provider Support", "PTO"}'),
('Himanshu Sharma', 'HimS', 'attending', 1, '{"Rooms", "Admin", "Provider Support", "PTO"}'),
('Nicole Weiss', 'NW', 'attending', 0, '{"Video Visits", "Virtual Support", "E-consults", "PTO"}'),
('Sanjay Sivalokanathan', 'SS', 'fellow', 1, '{"Rooms", "PTO"}'),
('Won Joon Koh', 'WK', 'fellow', 1, '{"Rooms", "PTO"}'),
('Kristen Carter', 'KC', 'fellow', 1, '{"Rooms", "PTO"}'),
('Matthew Parker', 'MP', 'fellow', 1, '{"Rooms", "PTO"}'),
('Carlo Mannina', 'CM', 'fellow', 1, '{"Rooms", "PTO"}');

-- ============================================
-- STEP 3: INSERT SERVICES (25 total - IN EXACT ORDER)
-- ============================================

-- MAIN CALENDAR SERVICES (show_on_main_calendar = true)

-- 1. PTO
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('PTO', 'BOTH', FALSE, 'PTO', TRUE);

-- 2-3. Inpatient
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Inpatient AM', 'AM', FALSE, 'Inpatient', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Inpatient PM', 'PM', FALSE, 'Inpatient', TRUE);

-- 4-10. Echo and Nuclear Services
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Fourth Floor Echo Lab', 'BOTH', FALSE, 'Fourth Floor Echo Lab', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Echo TTE AM', 'AM', FALSE, 'Echo TTE', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Echo TTE PM', 'PM', FALSE, 'Echo TTE', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Stress Echo AM', 'AM', FALSE, 'Stress Echo', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Stress Echo PM', 'PM', FALSE, 'Stress Echo', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Nuclear Stress', 'BOTH', FALSE, 'Nuclear Stress', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Nuclear', 'BOTH', FALSE, 'Nuclear', TRUE);

-- 11-12. Rooms
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Rooms AM', 'AM', TRUE, 'Rooms', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Rooms PM', 'PM', TRUE, 'Rooms', TRUE);

-- 13. Precepting
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Precepting', 'BOTH', FALSE, 'Precepting', TRUE);

-- 14-15. Admin
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Admin AM', 'AM', FALSE, 'Admin', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Admin PM', 'PM', FALSE, 'Admin', TRUE);

-- 16-17. Offsites
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Offsites AM', 'AM', FALSE, 'Offsites', TRUE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Offsites PM', 'PM', FALSE, 'Offsites', TRUE);

-- PROVIDER-ONLY SERVICES (show_on_main_calendar = false)

-- 18-19. Video Visits
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Video Visits AM', 'AM', FALSE, 'Video Visits', FALSE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Video Visits PM', 'PM', FALSE, 'Video Visits', FALSE);

-- 20. Hospital at Home
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Hospital at Home', 'BOTH', FALSE, 'Hospital at Home', FALSE);

-- 21-22. E-consults
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('E-consults AM', 'AM', FALSE, 'E-consults', FALSE);

INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('E-consults PM', 'PM', FALSE, 'E-consults', FALSE);

-- 23. Vascular
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('Vascular', 'BOTH', FALSE, 'Vascular', FALSE);

-- 24. CT
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('CT', 'BOTH', FALSE, 'CT', FALSE);

-- 25. CMR
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
VALUES ('CMR', 'BOTH', FALSE, 'CMR', FALSE);

-- ============================================
-- VERIFY SETUP
-- ============================================

SELECT
  (SELECT COUNT(*) FROM providers) AS providers_count,
  (SELECT COUNT(*) FROM services) AS services_count,
  (SELECT COUNT(*) FROM services WHERE show_on_main_calendar = TRUE) AS main_calendar_services_count,
  (SELECT COUNT(*) FROM services WHERE show_on_main_calendar = FALSE) AS provider_only_services_count;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT '✅ Database setup complete!' AS status,
       '32 providers inserted' AS providers,
       '25 services inserted (17 main calendar + 8 provider-only)' AS services,
       'Ready to create schedule assignments' AS next_step;
