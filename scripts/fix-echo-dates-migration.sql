-- ============================================
-- FIX ECHO DATES - TIMEZONE BUG MIGRATION
-- ============================================
-- This script fixes dates that were shifted backward by 1 day
-- due to the toISOString() UTC conversion bug.
--
-- The bug caused dates to be stored as the previous day
-- (e.g., Wednesday Jan 7 was stored as Tuesday Jan 6)
--
-- Run this in your Supabase SQL Editor
-- ============================================

-- First, let's see what data we have (for verification)
-- Run these SELECT statements first to review before updating

-- Review echo_pto data for January 2026
SELECT
  p.id,
  p.date as current_date,
  p.date + INTERVAL '1 day' as corrected_date,
  t.name as tech_name,
  p.time_block,
  p.reason
FROM echo_pto p
JOIN echo_techs t ON p.echo_tech_id = t.id
WHERE p.date >= '2026-01-01' AND p.date <= '2026-01-31'
ORDER BY p.date, t.name;

-- Review echo_schedule_assignments data for January 2026
SELECT
  a.id,
  a.date as current_date,
  a.date + INTERVAL '1 day' as corrected_date,
  r.short_name as room,
  t.name as tech_name,
  a.time_block
FROM echo_schedule_assignments a
JOIN echo_rooms r ON a.echo_room_id = r.id
JOIN echo_techs t ON a.echo_tech_id = t.id
WHERE a.date >= '2026-01-01' AND a.date <= '2026-01-31'
ORDER BY a.date, r.display_order, a.time_block;

-- ============================================
-- UNCOMMENT AND RUN THE UPDATES BELOW
-- AFTER REVIEWING THE SELECT RESULTS ABOVE
-- ============================================

-- Fix echo_pto dates - add 1 day to all January 2026 entries
-- UPDATE echo_pto
-- SET date = date + INTERVAL '1 day'
-- WHERE date >= '2026-01-01' AND date <= '2026-01-31';

-- Fix echo_schedule_assignments dates - add 1 day to all January 2026 entries
-- UPDATE echo_schedule_assignments
-- SET date = date + INTERVAL '1 day'
-- WHERE date >= '2026-01-01' AND date <= '2026-01-31';

-- ============================================
-- VERIFICATION QUERIES
-- Run these after the updates to verify the fix
-- ============================================

-- Verify Karina's PTO is now on Wednesdays (day 3)
-- SELECT
--   p.date,
--   EXTRACT(DOW FROM p.date) as day_of_week,
--   CASE EXTRACT(DOW FROM p.date)
--     WHEN 0 THEN 'Sunday'
--     WHEN 1 THEN 'Monday'
--     WHEN 2 THEN 'Tuesday'
--     WHEN 3 THEN 'Wednesday'
--     WHEN 4 THEN 'Thursday'
--     WHEN 5 THEN 'Friday'
--     WHEN 6 THEN 'Saturday'
--   END as day_name,
--   t.name,
--   p.reason
-- FROM echo_pto p
-- JOIN echo_techs t ON p.echo_tech_id = t.id
-- WHERE t.name = 'Karina'
--   AND p.date >= '2026-01-01'
--   AND p.date <= '2026-01-31'
-- ORDER BY p.date;
