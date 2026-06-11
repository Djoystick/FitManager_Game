-- Migration 00049: Add tactic column to teams
-- This allows the Match Engine V4 to read user-selected tactics.

ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS tactic text DEFAULT 'Balanced' NOT NULL;

-- Ensure existing teams have Balanced
UPDATE public.teams SET tactic = 'Balanced' WHERE tactic IS NULL;
