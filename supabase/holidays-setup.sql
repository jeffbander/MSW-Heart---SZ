-- Create holidays table for marking dates with special observance
-- Holidays can optionally block assignments (like weekends)

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  block_assignments BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Add comment explaining the table
COMMENT ON TABLE holidays IS 'Stores holiday dates that can be displayed on schedule grid and optionally block assignments';
COMMENT ON COLUMN holidays.block_assignments IS 'When true, cells are grayed out like weekends and assignments are blocked';
