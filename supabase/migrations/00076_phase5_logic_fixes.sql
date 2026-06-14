-- =============================================================================
-- Migration 00076: Phase 5 Logic Fixes
-- =============================================================================
-- Adds season_camps_played to teams for Training Camp tracking.
-- =============================================================================

-- Add season_camps_played to teams table (resets each season)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'season_camps_played'
  ) THEN
    ALTER TABLE teams ADD COLUMN season_camps_played INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN teams.season_camps_played IS
      'Number of Training Camp matches played this season. Resets at end-of-season. Max 3 per season.';
  END IF;
END;
$$;
