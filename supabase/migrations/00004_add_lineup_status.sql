-- 00004_add_lineup_status.sql

ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS is_ready_for_match BOOLEAN DEFAULT false;
