-- PTO Requests Table
-- Stores PTO requests that require admin approval

CREATE TABLE IF NOT EXISTS pto_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('maternity', 'vacation', 'medical', 'personal', 'conference', 'other')),
  time_block TEXT NOT NULL CHECK (time_block IN ('AM', 'PM', 'FULL')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_by TEXT NOT NULL CHECK (requested_by IN ('provider', 'admin')),
  reviewed_by_admin_name TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure start_date is before or equal to end_date
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Index for efficient lookups by provider
CREATE INDEX IF NOT EXISTS idx_pto_requests_provider_id ON pto_requests(provider_id);

-- Index for efficient status filtering
CREATE INDEX IF NOT EXISTS idx_pto_requests_status ON pto_requests(status);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_pto_requests_dates ON pto_requests(start_date, end_date);

-- Enable Row Level Security (optional, depending on your auth setup)
-- ALTER TABLE pto_requests ENABLE ROW LEVEL SECURITY;
