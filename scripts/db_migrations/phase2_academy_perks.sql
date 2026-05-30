-- SQL Migration: Phase 2 Academy Perks
-- Add `academy_perks` JSONB column to `infrastructure` table

ALTER TABLE public.infrastructure 
ADD COLUMN IF NOT EXISTS academy_perks JSONB DEFAULT '[]'::jsonb;

-- Also, ensure `is_retired` exists on players table. Currently it is `is_nft_coach`.
-- Let's just rename `is_nft_coach` to `is_retired` to be more semantic, or add `is_retired`.
-- Actually, renaming might break existing code, so we will add `is_retired` boolean.

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_retired BOOLEAN DEFAULT false;
