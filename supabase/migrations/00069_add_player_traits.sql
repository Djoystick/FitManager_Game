-- Migration 00069: Add traits column to players table
-- Fixes 8+ UI components that reference player.traits (PlayerCard, SquadManager,
-- PlayerProfileModal, lineup/page.tsx, NextOpponentCard, ChemistryOverlay, etc.)

-- Add traits column (JSONB array of trait strings)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT '[]'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN players.traits IS
  'Array of special trait strings (e.g. "Speedster", "Playmaker", "CLINICAL_FINISHER"). '
  'Referenced by 8+ UI components. Populated via youth intake or achievement system.';

-- Create index for fast trait queries
CREATE INDEX IF NOT EXISTS idx_players_traits ON players USING GIN (traits);
