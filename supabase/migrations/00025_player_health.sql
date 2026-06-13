-- 00026_player_health.sql

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS injury_matches_left INTEGER NOT NULL DEFAULT 0;
