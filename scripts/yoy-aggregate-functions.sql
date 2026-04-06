-- Year-over-Year Aggregate Functions
-- Run this in Supabase SQL Editor to enable fast YoY queries
-- These replace fetching 250K+ rows with database-level GROUP BY

-- 1. Office visits: count by visit_type_category and report_month
--    Filters to Arrived/Completed statuses only
CREATE OR REPLACE FUNCTION yoy_office_visits(month_list TEXT[])
RETURNS TABLE(
  visit_type_category TEXT,
  report_month DATE,
  cnt BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(v.visit_type_category, 'Other') AS visit_type_category,
    v.report_month,
    COUNT(*) AS cnt
  FROM stat_office_visits v
  WHERE v.report_month = ANY(month_list::DATE[])
    AND v.source_type = 'all_statuses'
    AND v.appointment_status IN ('Arrived', 'Completed')
  GROUP BY COALESCE(v.visit_type_category, 'Other'), v.report_month
$$;

-- Fallback version without source_type filter
CREATE OR REPLACE FUNCTION yoy_office_visits_fallback(month_list TEXT[])
RETURNS TABLE(
  visit_type_category TEXT,
  report_month DATE,
  cnt BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(v.visit_type_category, 'Other') AS visit_type_category,
    v.report_month,
    COUNT(*) AS cnt
  FROM stat_office_visits v
  WHERE v.report_month = ANY(month_list::DATE[])
    AND v.appointment_status IN ('Arrived', 'Completed')
  GROUP BY COALESCE(v.visit_type_category, 'Other'), v.report_month
$$;

-- 2. Testing visits (completed source): count by dept, visit_type, report_month
CREATE OR REPLACE FUNCTION yoy_testing_completed(month_list TEXT[])
RETURNS TABLE(
  department_normalized TEXT,
  visit_type TEXT,
  report_month DATE,
  cnt BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(v.department_normalized, 'Unknown') AS department_normalized,
    COALESCE(v.visit_type, 'Unknown') AS visit_type,
    v.report_month,
    COUNT(*) AS cnt
  FROM stat_testing_visits v
  WHERE v.report_month = ANY(month_list::DATE[])
    AND v.source_type = 'completed'
    AND COALESCE(v.department_normalized, 'Unknown') != 'Other'
  GROUP BY COALESCE(v.department_normalized, 'Unknown'), COALESCE(v.visit_type, 'Unknown'), v.report_month
$$;

-- 3. Testing visits (all_statuses source, Completed only): count by dept, visit_type, report_month
CREATE OR REPLACE FUNCTION yoy_testing_all_statuses(month_list TEXT[])
RETURNS TABLE(
  department_normalized TEXT,
  visit_type TEXT,
  report_month DATE,
  cnt BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(v.department_normalized, 'Unknown') AS department_normalized,
    COALESCE(v.visit_type, 'Unknown') AS visit_type,
    v.report_month,
    COUNT(*) AS cnt
  FROM stat_testing_visits v
  WHERE v.report_month = ANY(month_list::DATE[])
    AND v.source_type = 'all_statuses'
    AND v.appointment_status = 'Completed'
    AND COALESCE(v.department_normalized, 'Unknown') != 'Other'
  GROUP BY COALESCE(v.department_normalized, 'Unknown'), COALESCE(v.visit_type, 'Unknown'), v.report_month
$$;

-- Fallback without source_type filter
CREATE OR REPLACE FUNCTION yoy_testing_fallback(month_list TEXT[])
RETURNS TABLE(
  department_normalized TEXT,
  visit_type TEXT,
  report_month DATE,
  cnt BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(v.department_normalized, 'Unknown') AS department_normalized,
    COALESCE(v.visit_type, 'Unknown') AS visit_type,
    v.report_month,
    COUNT(*) AS cnt
  FROM stat_testing_visits v
  WHERE v.report_month = ANY(month_list::DATE[])
    AND v.appointment_status = 'Completed'
    AND COALESCE(v.department_normalized, 'Unknown') != 'Other'
  GROUP BY COALESCE(v.department_normalized, 'Unknown'), COALESCE(v.visit_type, 'Unknown'), v.report_month
$$;
