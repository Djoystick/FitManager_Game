-- Phase 3, Phase 3: Manager Rivalries & Trophy Cabinet
-- Tables: manager_rivalries, trophy_cabinet

-- =============================================================================
-- MANAGER RIVALRIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS manager_rivalries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matches_played  INT NOT NULL DEFAULT 0,
  user_a_wins     INT NOT NULL DEFAULT 0,
  user_b_wins     INT NOT NULL DEFAULT 0,
  draws           INT NOT NULL DEFAULT 0,
  is_derby        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_rivalries_user_a ON manager_rivalries(user_a_id);
CREATE INDEX IF NOT EXISTS idx_rivalries_user_b ON manager_rivalries(user_b_id);

-- =============================================================================
-- TROPHY CABINET
-- =============================================================================
CREATE TABLE IF NOT EXISTS trophy_cabinet (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('CUP_GOLD', 'CUP_SILVER', 'ACHIEVEMENT')),
  description   TEXT,
  earned_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trophy_cabinet_user ON trophy_cabinet(user_id);
