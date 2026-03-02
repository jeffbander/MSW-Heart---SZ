-- Phase 1 Update: 3 reports -> 5 reports
-- Run this in Supabase SQL Editor

-- 1. Clear old data (incompatible with new 5-report structure)
DELETE FROM stat_office_visits;
DELETE FROM stat_testing_visits;
DELETE FROM stat_orders;
DELETE FROM stat_uploads;

-- 2. Update stat_uploads report_type constraint
ALTER TABLE stat_uploads DROP CONSTRAINT IF EXISTS stat_uploads_report_type_check;
-- (constraint may not exist if it wasn't created originally, so we just add the new one)

-- 3. Add source_type and late_cancel to stat_office_visits
ALTER TABLE stat_office_visits ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'completed';
ALTER TABLE stat_office_visits ADD COLUMN IF NOT EXISTS late_cancel SMALLINT DEFAULT 0;

-- 4. Add source_type, resource, and visit_date to stat_testing_visits
ALTER TABLE stat_testing_visits ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'completed';
ALTER TABLE stat_testing_visits ADD COLUMN IF NOT EXISTS resource VARCHAR(255);
ALTER TABLE stat_testing_visits ADD COLUMN IF NOT EXISTS visit_date DATE;

-- 5. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_office_visits_source_type ON stat_office_visits(source_type);
CREATE INDEX IF NOT EXISTS idx_testing_visits_source_type ON stat_testing_visits(source_type);
CREATE INDEX IF NOT EXISTS idx_testing_visits_visit_date ON stat_testing_visits(visit_date);
