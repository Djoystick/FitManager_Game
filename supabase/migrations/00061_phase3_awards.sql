-- Phase 3, Phase 2: Season Awards
-- Table: season_awards

CREATE TABLE IF NOT EXISTS season_awards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL,
  award_type    TEXT NOT NULL CHECK (award_type IN ('GOLDEN_BOOT', 'GOLDEN_GLOVE', 'MVP')),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, award_type)
);

CREATE INDEX IF NOT EXISTS idx_season_awards_season ON season_awards(season_id);
CREATE INDEX IF NOT EXISTS idx_season_awards_team ON season_awards(team_id);
