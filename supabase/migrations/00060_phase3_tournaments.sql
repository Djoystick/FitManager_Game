-- Phase 3, Phase 1: Cup Tournaments & Penalty Shootouts
-- Tables: tournaments, tournament_participants, tournament_matches

-- =============================================================================
-- TOURNAMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'active', 'completed')),
  tier          INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TOURNAMENT PARTICIPANTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS tournament_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

-- =============================================================================
-- TOURNAMENT MATCHES
-- =============================================================================
CREATE TABLE IF NOT EXISTS tournament_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round           TEXT NOT NULL CHECK (round IN ('round_of_16', 'quarter_final', 'semi_final', 'final')),
  match_order     INT NOT NULL DEFAULT 0,
  team_home       UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_away       UUID REFERENCES teams(id) ON DELETE SET NULL,
  score_home      INT,
  score_away      INT,
  penalty_home    INT,
  penalty_away    INT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  events          JSONB DEFAULT '[]',
  stamina_drain   JSONB DEFAULT '{"home": {}, "away": {}}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tid ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tid ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
