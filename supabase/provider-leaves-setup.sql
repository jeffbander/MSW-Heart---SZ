-- Provider Leaves Table
-- Stores date-range based unavailability (maternity leave, vacation, etc.)

CREATE TABLE IF NOT EXISTS provider_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('maternity', 'vacation', 'medical', 'personal', 'conference', 'other')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure start_date is before or equal to end_date
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Index for efficient lookups by provider
CREATE INDEX IF NOT EXISTS idx_provider_leaves_provider_id ON provider_leaves(provider_id);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_provider_leaves_dates ON provider_leaves(start_date, end_date);

-- Enable Row Level Security (optional, depending on your auth setup)
-- ALTER TABLE provider_leaves ENABLE ROW LEVEL SECURITY;
