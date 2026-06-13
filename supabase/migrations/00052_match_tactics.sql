ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS home_tactic text DEFAULT 'Balanced',
ADD COLUMN IF NOT EXISTS away_tactic text DEFAULT 'Balanced';

UPDATE public.league_matches SET home_tactic = 'Balanced' WHERE home_tactic IS NULL;
UPDATE public.league_matches SET away_tactic = 'Balanced' WHERE away_tactic IS NULL;
