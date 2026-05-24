-- 00012_add_team_formation.sql

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS formation VARCHAR(20) DEFAULT '4-4-2';
