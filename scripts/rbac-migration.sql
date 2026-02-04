-- RBAC Migration: Role-Based Access Control for Cardiology Scheduler
-- Run this in Supabase SQL Editor

-- 1. Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','scheduler_full','scheduler_limited','provider','viewer')),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  allowed_service_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);

-- 4. Seed initial super_admin user
-- Password: admin123 (bcrypt hash)
-- IMPORTANT: Change this password after first login!
INSERT INTO app_users (username, password_hash, display_name, role)
VALUES (
  'admin',
  '$2b$10$I06di8HFbNCf/lGxwnVSZeFQi9XfCFYy/5oLreSM4v7y4h42hWWVa',
  'System Administrator',
  'super_admin'
)
ON CONFLICT (username) DO NOTHING;

-- 5. Add can_manage_testing permission column
ALTER TABLE app_users ADD COLUMN can_manage_testing BOOLEAN NOT NULL DEFAULT FALSE;
