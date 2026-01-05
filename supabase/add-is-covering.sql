-- Add is_covering column to schedule_assignments
-- This marks when a provider is covering for someone else (not the regular person)

ALTER TABLE schedule_assignments ADD COLUMN IF NOT EXISTS is_covering BOOLEAN DEFAULT false;
