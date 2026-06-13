-- Migration to add fields for Match Resolver

ALTER TABLE public.league_matches 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stamina_drain JSONB DEFAULT '{}'::jsonb;
