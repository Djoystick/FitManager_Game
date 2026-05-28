-- Migration: Add home/away viewed flags for Unseen Matches functionality
ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS home_team_viewed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS away_team_viewed BOOLEAN DEFAULT FALSE;
