-- Avatar Border System
-- Adds active_border and unlocked_borders columns to users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active_border text DEFAULT 'default';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS unlocked_borders text[] DEFAULT ARRAY['default']::text[];
