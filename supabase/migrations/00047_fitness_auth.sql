-- Migration: Add fitness sync fields
-- Adds google_refresh_token, timezone_offset to users
-- Creates fitness_sync_logs table

-- 1. Add fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_offset_mins INTEGER DEFAULT 0;

-- 2. Create fitness_sync_logs
CREATE TABLE IF NOT EXISTS fitness_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    steps_synced INTEGER NOT NULL,
    sp_rewarded INTEGER NOT NULL,
    velocity_steps_per_min INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of last sync
CREATE INDEX IF NOT EXISTS idx_fitness_sync_logs_user_id ON fitness_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_sync_logs_created_at ON fitness_sync_logs(created_at);

-- Set up RLS for fitness_sync_logs
ALTER TABLE fitness_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
    ON fitness_sync_logs FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- No insert policy. Inserts are only allowed via Service Role Key (Backend API).
