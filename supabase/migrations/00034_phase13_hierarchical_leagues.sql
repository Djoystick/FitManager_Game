-- ==========================================================
-- 00035_phase13_hierarchical_leagues.sql
-- Phase 13: Hierarchical League Universe
-- ==========================================================

BEGIN;

-- 1. Create league_tiers
CREATE TABLE IF NOT EXISTS public.league_tiers (
    level INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    prize_pool_percentage INTEGER NOT NULL DEFAULT 100
);

-- Insert 15 tiers
INSERT INTO public.league_tiers (level, name, prize_pool_percentage) VALUES
(1, 'Galactic Premier League', 1000),
(2, 'Elite Division I', 800),
(3, 'Elite Division II', 700),
(4, 'Pro Division I', 600),
(5, 'Pro Division II', 500),
(6, 'Challenger Division I', 450),
(7, 'Challenger Division II', 400),
(8, 'Rivals Division I', 350),
(9, 'Rivals Division II', 300),
(10, 'Contender Division I', 250),
(11, 'Contender Division II', 200),
(12, 'Amateur Division I', 150),
(13, 'Amateur Division II', 120),
(14, 'Rookie Division', 110),
(15, 'Training Grounds', 100)
ON CONFLICT (level) DO NOTHING;

-- 2. Create league_instances
CREATE TABLE IF NOT EXISTS public.league_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_level INTEGER REFERENCES public.league_tiers(level) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'filling' CHECK (status IN ('filling', 'active', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Modify league_standings
-- Note: existing unique constraint is UNIQUE(team_id). We need to drop it.
ALTER TABLE public.league_standings
  DROP CONSTRAINT IF EXISTS league_standings_team_id_key;

-- Add league_instance_id
ALTER TABLE public.league_standings
  ADD COLUMN IF NOT EXISTS league_instance_id UUID REFERENCES public.league_instances(id) ON DELETE CASCADE;

-- Add new composite unique constraint so a team is only once in an instance
ALTER TABLE public.league_standings
  ADD CONSTRAINT league_standings_team_instance_unique UNIQUE (team_id, league_instance_id);

-- 4. Modify league_matches
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS league_instance_id UUID REFERENCES public.league_instances(id) ON DELETE CASCADE;

COMMIT;
