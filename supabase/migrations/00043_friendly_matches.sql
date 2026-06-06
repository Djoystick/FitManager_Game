-- Add friendly_matches_played to teams table
ALTER TABLE public.teams
ADD COLUMN friendly_matches_played INTEGER DEFAULT 0 NOT NULL;
