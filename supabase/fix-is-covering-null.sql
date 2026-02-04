-- Fix any NULL values in is_covering column
-- Run this after adding the is_covering column

UPDATE schedule_assignments
SET is_covering = false
WHERE is_covering IS NULL;

-- Verify the fix
SELECT COUNT(*) as total,
       COUNT(CASE WHEN is_covering = true THEN 1 END) as covering,
       COUNT(CASE WHEN is_covering = false THEN 1 END) as not_covering,
       COUNT(CASE WHEN is_covering IS NULL THEN 1 END) as null_values
FROM schedule_assignments;
