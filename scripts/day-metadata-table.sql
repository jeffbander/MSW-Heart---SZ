-- Day Metadata table for storing day notes and room metadata
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS day_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time_block TEXT NOT NULL DEFAULT 'DAY',
  chp_room_in_use BOOLEAN DEFAULT FALSE,
  chp_room_note TEXT,
  extra_room_available BOOLEAN DEFAULT FALSE,
  extra_room_note TEXT,
  day_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Required for the API's upsert onConflict
ALTER TABLE day_metadata ADD CONSTRAINT day_metadata_date_time_block_unique UNIQUE (date, time_block);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_day_metadata_date ON day_metadata (date);
