-- Migration to add is_viewed to league_matches and sweat_points to teams
ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS is_viewed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS sweat_points INTEGER DEFAULT 0;
