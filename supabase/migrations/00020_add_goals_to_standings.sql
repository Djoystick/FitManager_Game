-- 00003_add_goals_to_standings.sql

-- Add goals_for and goals_against to league_standings table
ALTER TABLE public.league_standings ADD COLUMN IF NOT EXISTS goals_for INTEGER DEFAULT 0;
ALTER TABLE public.league_standings ADD COLUMN IF NOT EXISTS goals_against INTEGER DEFAULT 0;

-- Note: goal difference can be calculated dynamically as (goals_for - goals_against)
