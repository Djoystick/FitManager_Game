-- Migration: Add fitness sync fields
-- Adds google_refresh_token, timezone_offset to users

-- 1. Add fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_offset_mins INTEGER DEFAULT 0;
