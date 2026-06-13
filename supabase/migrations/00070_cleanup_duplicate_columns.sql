-- Migration 00070: Clean up duplicate/legacy columns
-- WARNING: Run during low-traffic window. Columns are dropped permanently.

-- 1. Drop duplicate match_events (keep events column from migration 20260527101700)
-- First, copy any data from match_events to events where events is NULL
UPDATE league_matches
SET events = match_events
WHERE events IS NULL AND match_events IS NOT NULL;

-- Then drop the duplicate
ALTER TABLE league_matches DROP COLUMN IF EXISTS match_events;

-- 2. Drop legacy is_played (keep status column)
-- First, sync status from is_played where status is inconsistent
UPDATE league_matches
SET status = CASE WHEN is_played = true THEN 'completed' ELSE 'pending' END
WHERE status IS NULL OR (is_played = true AND status != 'completed');

ALTER TABLE league_matches DROP COLUMN IF EXISTS is_played;

-- 3. Drop legacy home_team_viewed / away_team_viewed (keep is_viewed)
ALTER TABLE league_matches DROP COLUMN IF EXISTS home_team_viewed;
ALTER TABLE league_matches DROP COLUMN IF EXISTS away_team_viewed;

-- 4. Drop legacy users columns
ALTER TABLE users DROP COLUMN IF EXISTS daily_steps_logged;
ALTER TABLE users DROP COLUMN IF EXISTS last_sync_date;

-- 5. Drop legacy infrastructure column
ALTER TABLE infrastructure DROP COLUMN IF EXISTS training_camp_level;

-- 6. Drop legacy transfer_market table (superseded by market_listings)
DROP TABLE IF EXISTS transfer_market CASCADE;
