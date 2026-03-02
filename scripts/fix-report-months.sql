-- Fix report_month on existing data to use actual per-row dates
-- instead of the single detected month from file metadata

-- Office visits: derive month from visit_date
UPDATE stat_office_visits
SET report_month = DATE_TRUNC('month', visit_date)::date
WHERE visit_date IS NOT NULL;

-- Testing visits: derive month from start_date (the appointment date)
UPDATE stat_testing_visits
SET report_month = DATE_TRUNC('month', start_date)::date
WHERE start_date IS NOT NULL;

-- Orders: derive month from visit_date, falling back to order_date
UPDATE stat_orders
SET report_month = DATE_TRUNC('month', COALESCE(visit_date, order_date))::date
WHERE COALESCE(visit_date, order_date) IS NOT NULL;

-- Drop the UNIQUE constraint on stat_uploads since one file can span many months
ALTER TABLE stat_uploads DROP CONSTRAINT IF EXISTS stat_uploads_report_type_report_month_key;
