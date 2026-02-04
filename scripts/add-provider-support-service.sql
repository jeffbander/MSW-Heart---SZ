-- ============================================
-- Add Provider Support Service
-- ============================================
-- This migration adds the "Provider Support" service for NPs/PAs
-- to indicate which provider they are supporting for the day.
-- The service shows only in Provider View (not Main Calendar).

-- Insert Provider Support service if it doesn't already exist
INSERT INTO services (name, time_block, requires_rooms, required_capability, show_on_main_calendar)
SELECT 'Provider Support', 'BOTH', FALSE, 'Provider Support', FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Provider Support'
);

-- Verify the service was created
SELECT id, name, time_block, required_capability, show_on_main_calendar
FROM services
WHERE name = 'Provider Support';
