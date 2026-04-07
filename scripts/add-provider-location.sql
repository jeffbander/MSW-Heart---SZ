-- Add location column to providers table
-- Values: 'west', 'morningside', 'other'
ALTER TABLE providers ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;
