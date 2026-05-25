-- 00025_add_match_events.sql

ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS match_events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_knockout BOOLEAN DEFAULT false;
