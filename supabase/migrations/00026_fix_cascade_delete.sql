-- 00027_fix_cascade_delete.sql

-- 1. Table: players (Column: team_id)
ALTER TABLE IF EXISTS public.players DROP CONSTRAINT IF EXISTS players_team_id_fkey;
ALTER TABLE IF EXISTS public.players ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 2. Table: matches (Columns: home_team_id, away_team_id)
ALTER TABLE IF EXISTS public.matches DROP CONSTRAINT IF EXISTS matches_home_team_id_fkey;
ALTER TABLE IF EXISTS public.matches ADD CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.matches DROP CONSTRAINT IF EXISTS matches_away_team_id_fkey;
ALTER TABLE IF EXISTS public.matches ADD CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 3. Table: league_standings (Column: team_id)
ALTER TABLE IF EXISTS public.league_standings DROP CONSTRAINT IF EXISTS league_standings_team_id_fkey;
ALTER TABLE IF EXISTS public.league_standings ADD CONSTRAINT league_standings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 4. Table: infrastructure (Column: team_id)
ALTER TABLE IF EXISTS public.infrastructure DROP CONSTRAINT IF EXISTS infrastructure_team_id_fkey;
ALTER TABLE IF EXISTS public.infrastructure ADD CONSTRAINT infrastructure_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 5. Table: league_matches (Columns: home_team_id, away_team_id)
ALTER TABLE IF EXISTS public.league_matches DROP CONSTRAINT IF EXISTS league_matches_home_team_id_fkey;
ALTER TABLE IF EXISTS public.league_matches ADD CONSTRAINT league_matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.league_matches DROP CONSTRAINT IF EXISTS league_matches_away_team_id_fkey;
ALTER TABLE IF EXISTS public.league_matches ADD CONSTRAINT league_matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
