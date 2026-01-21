-- Seed 2026 US Federal Holidays
-- All holidays have block_assignments = true to gray out cells like weekends

INSERT INTO holidays (date, name, block_assignments) VALUES
  ('2026-01-01', 'New Year''s Day', true),
  ('2026-01-19', 'Martin Luther King Jr. Day', true),
  ('2026-02-16', 'Presidents Day', true),
  ('2026-05-25', 'Memorial Day', true),
  ('2026-06-19', 'Juneteenth', true),
  ('2026-07-04', 'Independence Day', true),
  ('2026-09-07', 'Labor Day', true),
  ('2026-10-12', 'Columbus Day', true),
  ('2026-11-11', 'Veterans Day', true),
  ('2026-11-26', 'Thanksgiving', true),
  ('2026-12-25', 'Christmas Day', true)
ON CONFLICT (date) DO UPDATE SET
  name = EXCLUDED.name,
  block_assignments = EXCLUDED.block_assignments;
