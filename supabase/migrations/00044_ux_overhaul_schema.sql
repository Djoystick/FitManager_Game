-- =============================================================================
-- Migration 00044: UX Overhaul Schema
-- Adds: staff, manager_objectives, social_posts tables
-- Extends: infrastructure (stadium sub-facilities, ticket pricing)
-- Extends: users (manager_level, manager_xp, yearly_profit)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. STAFF TABLE
--    Coaches and scouts attached to a team.
--    department: first_team | academy
--    role:       head_coach | assistant_coach | gk_coach | fitness_coach | scout
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id           UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  role              VARCHAR(50)  NOT NULL DEFAULT 'assistant_coach'
                    CHECK (role IN ('head_coach','assistant_coach','gk_coach','fitness_coach','scout')),
  department        VARCHAR(20)  NOT NULL DEFAULT 'first_team'
                    CHECK (department IN ('first_team','academy')),
  age               INTEGER      NOT NULL DEFAULT 35 CHECK (age BETWEEN 18 AND 80),
  nationality       VARCHAR(80)  NOT NULL DEFAULT 'Unknown',
  contract_end      DATE         NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  salary_per_match  INTEGER      NOT NULL DEFAULT 100 CHECK (salary_per_match >= 0),
  -- Coaching attribute ratings (0-99)
  attr_def          INTEGER NOT NULL DEFAULT 50 CHECK (attr_def BETWEEN 0 AND 99),
  attr_pas          INTEGER NOT NULL DEFAULT 50 CHECK (attr_pas BETWEEN 0 AND 99),
  attr_sho          INTEGER NOT NULL DEFAULT 50 CHECK (attr_sho BETWEEN 0 AND 99),
  attr_pac          INTEGER NOT NULL DEFAULT 50 CHECK (attr_pac BETWEEN 0 AND 99),
  attr_phy          INTEGER NOT NULL DEFAULT 50 CHECK (attr_phy BETWEEN 0 AND 99),
  attr_men          INTEGER NOT NULL DEFAULT 50 CHECK (attr_men BETWEEN 0 AND 99),
  attr_gkp          INTEGER NOT NULL DEFAULT 15 CHECK (attr_gkp BETWEEN 0 AND 99),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_team_id   ON public.staff(team_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON public.staff(team_id, department);

COMMENT ON TABLE public.staff IS 'Coaching staff and scouts for each team.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Auto-create default staff when a team is created
--    Seeds: 1 head coach + 1 assistant + 1 scout per new team.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_create_default_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_names TEXT[]    := ARRAY['Carlos Mendez','Anton Volkov','Marco Ricci','David Osei',
                              'James Harrington','Yuki Tanaka','Lukas Bauer','Ahmed Hassan'];
  v_nationalities TEXT[] := ARRAY['Spain','Russia','Italy','Ghana','England','Japan','Germany','Egypt'];
  v_idx INTEGER;
BEGIN
  -- Head coach (focus on mentality and defense)
  v_idx := 1 + (floor(random() * 8))::INT;
  INSERT INTO public.staff (
    team_id, name, role, department, age, nationality,
    salary_per_match,
    attr_def, attr_pas, attr_sho, attr_pac, attr_phy, attr_men, attr_gkp
  ) VALUES (
    NEW.id,
    v_names[v_idx], 'head_coach', 'first_team',
    30 + (floor(random() * 20))::INT,
    v_nationalities[v_idx],
    250,
    50 + (floor(random() * 25))::INT,
    50 + (floor(random() * 20))::INT,
    40 + (floor(random() * 20))::INT,
    40 + (floor(random() * 20))::INT,
    45 + (floor(random() * 20))::INT,
    55 + (floor(random() * 25))::INT,
    10
  );

  -- Assistant coach (balanced)
  v_idx := 1 + (floor(random() * 8))::INT;
  INSERT INTO public.staff (
    team_id, name, role, department, age, nationality,
    salary_per_match,
    attr_def, attr_pas, attr_sho, attr_pac, attr_phy, attr_men, attr_gkp
  ) VALUES (
    NEW.id,
    v_names[v_idx], 'assistant_coach', 'first_team',
    28 + (floor(random() * 15))::INT,
    v_nationalities[v_idx],
    150,
    40 + (floor(random() * 20))::INT,
    45 + (floor(random() * 20))::INT,
    45 + (floor(random() * 20))::INT,
    40 + (floor(random() * 20))::INT,
    40 + (floor(random() * 20))::INT,
    40 + (floor(random() * 20))::INT,
    10
  );

  -- Scout
  v_idx := 1 + (floor(random() * 8))::INT;
  INSERT INTO public.staff (
    team_id, name, role, department, age, nationality,
    salary_per_match,
    attr_def, attr_pas, attr_sho, attr_pac, attr_phy, attr_men, attr_gkp
  ) VALUES (
    NEW.id,
    v_names[v_idx], 'scout', 'first_team',
    25 + (floor(random() * 20))::INT,
    v_nationalities[v_idx],
    80,
    30 + (floor(random() * 20))::INT,
    50 + (floor(random() * 20))::INT,
    30 + (floor(random() * 20))::INT,
    55 + (floor(random() * 20))::INT,
    35 + (floor(random() * 20))::INT,
    45 + (floor(random() * 20))::INT,
    10
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_staff ON public.teams;
CREATE TRIGGER trg_auto_staff
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_create_default_staff();

-- Back-fill existing teams that have no staff yet
DO $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN
    SELECT t.id FROM public.teams t
    WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.team_id = t.id)
  LOOP
    -- Minimal seed: just head coach
    INSERT INTO public.staff (team_id, name, role, department, salary_per_match,
      attr_def, attr_pas, attr_sho, attr_pac, attr_phy, attr_men, attr_gkp)
    VALUES (
      v_team.id, 'Default Coach', 'head_coach', 'first_team', 200,
      55, 50, 45, 45, 50, 60, 10
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MANAGER OBJECTIVES TABLE
--    Season-level targets set by the "board".
--    Approval rating tracks how satisfied the board is (0-100).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.manager_objectives (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id          UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season           INTEGER     NOT NULL DEFAULT 1,
  title            VARCHAR(255) NOT NULL,
  competition      VARCHAR(100) NOT NULL DEFAULT 'League',
  target           VARCHAR(100) NOT NULL,
  priority         VARCHAR(20)  NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('high','medium','low')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','achieved','failed')),
  approval_rating  INTEGER     NOT NULL DEFAULT 65
                   CHECK (approval_rating BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_objectives_team ON public.manager_objectives(team_id, season);

COMMENT ON TABLE public.manager_objectives IS
  'Board-set seasonal objectives for the manager. Tracks approval rating per team.';

-- Auto-create default season 1 objectives on team creation
CREATE OR REPLACE FUNCTION public.fn_auto_create_objectives()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.manager_objectives (team_id, season, title, competition, target, priority, approval_rating)
  VALUES
    (NEW.id, 1, 'League Finish',   'Pro League',   'Top 8', 'high',   70),
    (NEW.id, 1, 'Cup Run',         'National Cup',  'Top 16','medium', 65),
    (NEW.id, 1, 'Squad Development','Internal',     'Avg OVR 60+', 'low', 60);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_objectives ON public.teams;
CREATE TRIGGER trg_auto_objectives
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_create_objectives();

-- Back-fill existing teams
INSERT INTO public.manager_objectives (team_id, season, title, competition, target, priority)
SELECT t.id, 1, 'League Finish', 'Pro League', 'Top 8', 'high'
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.manager_objectives o WHERE o.team_id = t.id
)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SOCIAL_POSTS TABLE — WOOF Feed
--    Includes player-written posts and system-generated match/transfer events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_posts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_team_id  UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  author_name     VARCHAR(255) NOT NULL DEFAULT 'Anonymous',
  author_handle   VARCHAR(100) NOT NULL DEFAULT '@anon',
  category        VARCHAR(30)  NOT NULL DEFAULT 'general'
                  CHECK (category IN ('general','transfer','my_team','award','interview')),
  content         TEXT         NOT NULL,
  likes           INTEGER      NOT NULL DEFAULT 0 CHECK (likes >= 0),
  is_system_post  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_cat  ON public.social_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_team ON public.social_posts(author_team_id, created_at DESC);

COMMENT ON TABLE public.social_posts IS
  'WOOF social feed. system_post=true means auto-generated from match/transfer events.';

-- Seed a few global starter posts so the feed is not empty
INSERT INTO public.social_posts (author_name, author_handle, category, content, is_system_post)
VALUES
  ('CyberCoach', '@cybercoach', 'general', '⚡ The new season has begun! May the best algorithm win. #FitManager', true),
  ('Scout Network', '@scoutnet', 'transfer', '🔍 Transfer window is heating up. Big moves incoming across all divisions.', true),
  ('FitManager HQ', '@fitmanagerhq', 'award', '🏆 Season achievements have been reset. Grind starts now!', true)
ON CONFLICT DO NOTHING;

-- Paginated feed RPC
CREATE OR REPLACE FUNCTION public.get_social_feed(
  p_category TEXT    DEFAULT 'general',
  p_limit    INTEGER DEFAULT 20,
  p_offset   INTEGER DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  author_name     TEXT,
  author_handle   TEXT,
  author_team_id  UUID,
  category        TEXT,
  content         TEXT,
  likes           INTEGER,
  is_system_post  BOOLEAN,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id, author_name::TEXT, author_handle::TEXT,
    author_team_id, category::TEXT, content,
    likes, is_system_post, created_at
  FROM public.social_posts
  WHERE (p_category = 'general' OR category = p_category)
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_social_feed(TEXT, INTEGER, INTEGER) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. EXTEND infrastructure TABLE — Stadium sub-facilities + ticket pricing
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.infrastructure
  ADD COLUMN IF NOT EXISTS club_store_level      INTEGER NOT NULL DEFAULT 1 CHECK (club_store_level >= 1),
  ADD COLUMN IF NOT EXISTS pitch_level           INTEGER NOT NULL DEFAULT 1 CHECK (pitch_level >= 1),
  ADD COLUMN IF NOT EXISTS lighting_level        INTEGER NOT NULL DEFAULT 1 CHECK (lighting_level >= 1),
  ADD COLUMN IF NOT EXISTS seating_level         INTEGER NOT NULL DEFAULT 1 CHECK (seating_level >= 1),
  ADD COLUMN IF NOT EXISTS services_level        INTEGER NOT NULL DEFAULT 1 CHECK (services_level >= 1),
  ADD COLUMN IF NOT EXISTS ticket_price_league   INTEGER NOT NULL DEFAULT 20 CHECK (ticket_price_league >= 0),
  ADD COLUMN IF NOT EXISTS ticket_price_intcup   INTEGER NOT NULL DEFAULT 30 CHECK (ticket_price_intcup >= 0),
  ADD COLUMN IF NOT EXISTS ticket_price_natcup   INTEGER NOT NULL DEFAULT 25 CHECK (ticket_price_natcup >= 0),
  ADD COLUMN IF NOT EXISTS ticket_price_friendly INTEGER NOT NULL DEFAULT 10 CHECK (ticket_price_friendly >= 0);

COMMENT ON COLUMN public.infrastructure.club_store_level IS 'Club merchandise kiosk level; multiplies merch revenue.';
COMMENT ON COLUMN public.infrastructure.ticket_price_league IS 'FC ticket price for league matches (affects fan attendance).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. EXTEND users TABLE — Manager level, XP, yearly profit tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_level   INTEGER NOT NULL DEFAULT 1 CHECK (manager_level >= 1),
  ADD COLUMN IF NOT EXISTS manager_xp      INTEGER NOT NULL DEFAULT 0 CHECK (manager_xp >= 0),
  ADD COLUMN IF NOT EXISTS yearly_profit   BIGINT  NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.manager_level IS 'Manager level shown in top nav pill. Increases with XP from matches/achievements.';
COMMENT ON COLUMN public.users.yearly_profit IS 'Running total of net income this season (resets on season end).';

-- RPC: award_manager_xp — call after each match to level up manager
CREATE OR REPLACE FUNCTION public.award_manager_xp(
  p_user_id UUID,
  p_xp      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_level INTEGER;
  v_current_xp    INTEGER;
  v_new_xp        INTEGER;
  v_new_level     INTEGER;
  v_xp_per_level  INTEGER := 500; -- 500 XP per level
BEGIN
  SELECT manager_level, manager_xp
    INTO v_current_level, v_current_xp
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  v_new_xp    := v_current_xp + p_xp;
  v_new_level := v_current_level + FLOOR(v_new_xp / v_xp_per_level);
  v_new_xp    := v_new_xp % v_xp_per_level;

  UPDATE public.users
     SET manager_xp    = v_new_xp,
         manager_level = v_new_level
   WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'new_level',    v_new_level,
    'new_xp',       v_new_xp,
    'xp_added',     p_xp,
    'leveled_up',   v_new_level > v_current_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_manager_xp(UUID, INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Auto-post match result to social feed trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_post_match_social_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_home_name TEXT;
  v_away_name TEXT;
  v_msg       TEXT;
BEGIN
  -- Only fire for completed league matches with scores
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_home_name FROM public.teams WHERE id = NEW.home_team_id;
  SELECT name INTO v_away_name FROM public.teams WHERE id = NEW.away_team_id;

  v_msg := '⚽ ' || COALESCE(v_home_name,'?') || ' ' ||
            NEW.home_score || ' - ' || NEW.away_score ||
            ' ' || COALESCE(v_away_name,'?') ||
            ' · Round ' || COALESCE(NEW.round_number::TEXT, '?');

  INSERT INTO public.social_posts (author_name, author_handle, category, content, is_system_post)
  VALUES ('Match Engine', '@matchbot', 'general', v_msg, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_social_post ON public.league_matches;
CREATE TRIGGER trg_match_social_post
  AFTER UPDATE OF home_score, away_score ON public.league_matches
  FOR EACH ROW
  WHEN (NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL)
  EXECUTE FUNCTION public.fn_post_match_social_event();

COMMIT;
