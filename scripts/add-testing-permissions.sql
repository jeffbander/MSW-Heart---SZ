-- Add granular testing permissions column
-- When can_manage_testing is true and testing_permissions is NULL, all features are enabled (backward compatible)
-- When testing_permissions has values, only those features are enabled
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS testing_permissions JSONB DEFAULT NULL;

-- Example: grant a user only assignment editing
-- UPDATE app_users SET testing_permissions = '{"edit_assignments": true, "edit_pto": false, "manage_templates": false, "manage_rooms": false}' WHERE username = 'jsmith';
