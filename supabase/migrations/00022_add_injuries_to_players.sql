-- Add injuries column to players
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_injured boolean DEFAULT false;
