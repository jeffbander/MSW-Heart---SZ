-- PTO Balance Configuration Tables
-- Run this SQL in Supabase SQL Editor

-- Role-based default PTO allowances
CREATE TABLE IF NOT EXISTS pto_role_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL UNIQUE,
  annual_allowance DECIMAL(4,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default allowances by role
INSERT INTO pto_role_defaults (role, annual_allowance) VALUES
  ('Attending', 20.0),
  ('Fellow', 15.0),
  ('NP', 15.0),
  ('PA', 15.0)
ON CONFLICT (role) DO UPDATE SET annual_allowance = EXCLUDED.annual_allowance;

-- Provider-specific PTO configuration (optional overrides per year)
CREATE TABLE IF NOT EXISTS provider_pto_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_allowance DECIMAL(4,1), -- NULL = use role default
  carryover_days DECIMAL(4,1) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, year)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_pto_config_provider_year
ON provider_pto_config(provider_id, year);

-- Function to get a provider's PTO allowance for a given year
-- Returns: annual_allowance (from config or role default) + carryover_days
CREATE OR REPLACE FUNCTION get_provider_pto_allowance(
  p_provider_id UUID,
  p_year INTEGER
) RETURNS TABLE (
  annual_allowance DECIMAL(4,1),
  carryover_days DECIMAL(4,1),
  total_allowance DECIMAL(4,1),
  source TEXT
) AS $$
DECLARE
  v_role TEXT;
  v_config_allowance DECIMAL(4,1);
  v_carryover DECIMAL(4,1);
  v_role_default DECIMAL(4,1);
BEGIN
  -- Get provider's role
  SELECT role INTO v_role FROM providers WHERE id = p_provider_id;

  -- Get role default
  SELECT prd.annual_allowance INTO v_role_default
  FROM pto_role_defaults prd
  WHERE prd.role = v_role;

  -- Check for provider-specific config
  SELECT ppc.annual_allowance, ppc.carryover_days
  INTO v_config_allowance, v_carryover
  FROM provider_pto_config ppc
  WHERE ppc.provider_id = p_provider_id AND ppc.year = p_year;

  -- Use config if exists, otherwise role default
  IF v_config_allowance IS NOT NULL THEN
    annual_allowance := v_config_allowance;
    source := 'provider_config';
  ELSE
    annual_allowance := COALESCE(v_role_default, 20.0);
    source := 'role_default';
  END IF;

  carryover_days := COALESCE(v_carryover, 0);
  total_allowance := annual_allowance + carryover_days;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
