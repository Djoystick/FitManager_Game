-- 00005_add_player_stats_and_position.sql

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS position VARCHAR(10),
ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::JSONB;
