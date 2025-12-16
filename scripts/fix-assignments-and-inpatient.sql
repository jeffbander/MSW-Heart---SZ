-- ============================================
-- Fix #1: Remove UNIQUE constraint to allow multiple providers
-- ============================================

-- Drop the unique constraint on schedule_assignments
ALTER TABLE schedule_assignments
DROP CONSTRAINT IF EXISTS schedule_assignments_date_service_id_time_block_key;

-- ============================================
-- Fix #2: Fix Inpatient service
-- ============================================

-- First, update the "Inpatient AM" service name to just "Inpatient"
UPDATE services
SET name = 'Inpatient'
WHERE name = 'Inpatient AM';

-- Delete the "Inpatient PM" service (and cascade delete any assignments)
DELETE FROM services
WHERE name = 'Inpatient PM';

-- ============================================
-- Verification
-- ============================================

SELECT 'Constraint removed - multiple providers now allowed' AS fix_1_status;

SELECT
  'Inpatient services fixed' AS fix_2_status,
  COUNT(*) AS inpatient_service_count,
  string_agg(name, ', ') AS service_names
FROM services
WHERE name LIKE 'Inpatient%';

-- Show all services for verification
SELECT name, time_block, show_on_main_calendar
FROM services
WHERE show_on_main_calendar = TRUE
ORDER BY created_at;
