-- Migration to add missing columns to league_matches
BEGIN;

ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS home_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stamina_drain JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_viewed BOOLEAN DEFAULT FALSE;

COMMIT;
