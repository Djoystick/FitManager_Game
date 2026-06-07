-- =============================================================================
-- Migration 00045: Stadium Facilities + Player Progression History
-- =============================================================================
-- 1. Add progression_history JSONB to players (OVR timeline for charts)
-- 2. Raise building upgrade cost formula: 800 → 3000 × level^1.8
-- 3. Add upgrade_stadium_facility() atomic RPC for 4 sub-facilities
-- 4. Add calculate_ticket_revenue() helper used by match engine
-- 5. Enable RLS on infrastructure (block direct client mutations)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PLAYER PROGRESSION HISTORY
--    Stored as JSONB array directly on the players row — no extra table,
--    no JOIN, cheap read. Each entry: {ovr: INT, recorded_at: ISO8601}.
--    Limited to last 30 entries (trimmed on write by the update_player_progression RPC).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS progression_history JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.players.progression_history IS
  'Ordered array of {ovr, recorded_at} snapshots. Appended each time training changes OVR. '
  'Max 30 entries (oldest trimmed). Powers the PROGRESSION tab graph in PlayerProfileModal.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: append_player_progression
--    Called by batchTrainPlayerAction after a successful OVR change.
--    Atomically appends a new snapshot and trims to last 30 entries.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.append_player_progression(
  p_player_id UUID,
  p_new_ovr   INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot JSONB;
  v_history  JSONB;
BEGIN
  -- Build new snapshot
  v_snapshot := jsonb_build_object('ovr', p_new_ovr, 'recorded_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));

  -- Read existing history
  SELECT COALESCE(progression_history, '[]'::jsonb)
    INTO v_history
    FROM public.players
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;

  -- Append new entry, keep last 30
  v_history := (
    SELECT jsonb_agg(e ORDER BY (e->>'recorded_at') ASC)
    FROM (
      SELECT jsonb_array_elements(v_history || v_snapshot) AS e
    ) sub
  );

  -- Trim to max 30 entries
  IF jsonb_array_length(v_history) > 30 THEN
    v_history := (
      SELECT jsonb_agg(e)
      FROM (
        SELECT e
        FROM jsonb_array_elements(v_history) WITH ORDINALITY AS t(e, rn)
        ORDER BY rn
        OFFSET jsonb_array_length(v_history) - 30
      ) sub
    );
  END IF;

  UPDATE public.players
     SET progression_history = v_history
   WHERE id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_player_progression(UUID, INTEGER) TO service_role;
COMMENT ON FUNCTION public.append_player_progression IS
  'Atomically appends an OVR snapshot to progression_history and trims to 30 entries. '
  'Called after every successful batchTrainPlayerAction.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RAISE BUILDING UPGRADE COST
--    Old: FLOOR(800 × level^1.8)
--    New: FLOOR(3000 × level^1.8)
--    lvl 1→2:  3,000 FC  | lvl 2→3: 10,392 FC | lvl 3→4: 23,148 FC
--    lvl 5→6: 53,977 FC  | lvl 7→8: 107,650 FC | lvl 9→10: 182,900 FC
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS building_upgrade_cost(INT);
CREATE OR REPLACE FUNCTION building_upgrade_cost(p_current_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT FLOOR(3000.0 * POWER(p_current_level::FLOAT, 1.8))::INT;
$$;

COMMENT ON FUNCTION building_upgrade_cost(INT) IS
  'FC cost to upgrade a building from p_current_level to p_current_level+1. '
  'Formula: FLOOR(3000 × level^1.8). Raised from 800 in migration 00045 for proper economy pacing.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENSURE FACILITY COLUMNS EXIST (safe idempotent adds)
--    These were added in 00044 but without max-level CHECK constraints.
--    We add the CHECK here idempotently.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- pitch_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure' AND column_name = 'pitch_level'
  ) THEN
    ALTER TABLE public.infrastructure
      ADD COLUMN pitch_level INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- lighting_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure' AND column_name = 'lighting_level'
  ) THEN
    ALTER TABLE public.infrastructure
      ADD COLUMN lighting_level INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- seating_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure' AND column_name = 'seating_level'
  ) THEN
    ALTER TABLE public.infrastructure
      ADD COLUMN seating_level INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- services_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure' AND column_name = 'services_level'
  ) THEN
    ALTER TABLE public.infrastructure
      ADD COLUMN services_level INTEGER NOT NULL DEFAULT 1;
  END IF;
END;
$$;

-- Add max-level constraints
ALTER TABLE public.infrastructure
  DROP CONSTRAINT IF EXISTS infrastructure_pitch_level_check,
  DROP CONSTRAINT IF EXISTS infrastructure_lighting_level_check,
  DROP CONSTRAINT IF EXISTS infrastructure_seating_level_check,
  DROP CONSTRAINT IF EXISTS infrastructure_services_level_check;

ALTER TABLE public.infrastructure
  ADD CONSTRAINT infrastructure_pitch_level_check    CHECK (pitch_level    BETWEEN 1 AND 10),
  ADD CONSTRAINT infrastructure_lighting_level_check CHECK (lighting_level BETWEEN 1 AND 10),
  ADD CONSTRAINT infrastructure_seating_level_check  CHECK (seating_level  BETWEEN 1 AND 10),
  ADD CONSTRAINT infrastructure_services_level_check CHECK (services_level BETWEEN 1 AND 10);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: upgrade_stadium_facility
--    Atomic: validates ownership → checks balance → deducts FC → upgrades level.
--    Cost formula: FLOOR(1500 × currentLevel^1.8)
--    Sub-facilities are cheaper than main buildings (1500 vs 3000 base).
--    lvl 1→2:  1,500 FC | lvl 2→3: 5,196 FC | lvl 3→4: 11,574 FC
--    lvl 5→6: 26,988 FC | lvl 7→8: 53,825 FC | lvl 9→10: 91,450 FC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upgrade_stadium_facility(
  p_team_id   UUID,
  p_facility  TEXT,   -- 'pitch' | 'lighting' | 'seating' | 'services'
  p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_column      TEXT;
  v_current_lvl INT;
  v_cost        INT;
  v_balance     INT;
  v_new_level   INT;
  v_new_balance INT;
BEGIN
  -- Map facility name to column
  v_column := CASE p_facility
    WHEN 'pitch'    THEN 'pitch_level'
    WHEN 'lighting' THEN 'lighting_level'
    WHEN 'seating'  THEN 'seating_level'
    WHEN 'services' THEN 'services_level'
    ELSE NULL
  END;

  IF v_column IS NULL THEN
    RAISE EXCEPTION 'Unknown facility type: %. Must be pitch|lighting|seating|services', p_facility;
  END IF;

  -- Verify team ownership (anti-cheat: can only upgrade your own team)
  PERFORM 1 FROM public.teams WHERE id = p_team_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forbidden: team % does not belong to user %', p_team_id, p_user_id;
  END IF;

  -- Lock and read current facility level
  EXECUTE format(
    'SELECT %I FROM public.infrastructure WHERE team_id = $1 FOR UPDATE',
    v_column
  ) INTO v_current_lvl USING p_team_id;

  IF v_current_lvl IS NULL THEN
    RAISE EXCEPTION 'Infrastructure record not found for team %', p_team_id;
  END IF;

  IF v_current_lvl >= 10 THEN
    RAISE EXCEPTION 'Facility already at maximum level (10). No further upgrades available.';
  END IF;

  -- Cost: FLOOR(1500 × currentLevel^1.8)
  v_cost      := FLOOR(1500.0 * POWER(v_current_lvl::FLOAT, 1.8))::INT;
  v_new_level := v_current_lvl + 1;

  -- Lock and read user balance
  SELECT balance_fancoins INTO v_balance
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient FanCoins. Required: %, Available: %', v_cost, v_balance;
  END IF;

  v_new_balance := v_balance - v_cost;

  -- Deduct balance
  UPDATE public.users
     SET balance_fancoins = v_new_balance
   WHERE id = p_user_id;

  -- Upgrade facility level
  EXECUTE format(
    'UPDATE public.infrastructure SET %I = $1 WHERE team_id = $2',
    v_column
  ) USING v_new_level, p_team_id;

  RETURN jsonb_build_object(
    'success',     true,
    'facility',    p_facility,
    'new_level',   v_new_level,
    'cost',        v_cost,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_stadium_facility(UUID, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.upgrade_stadium_facility IS
  'Atomic stadium sub-facility upgrade with ownership check. '
  'Cost: FLOOR(1500 × level^1.8). Max level 10. '
  'Locks both user and infrastructure rows to prevent race conditions.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TICKET REVENUE HELPER
--    Called by match engine to compute matchday ticket income.
--
--    Formula:
--      Attendance   = LEAST(actual_fans, stadium_level × 5000)
--      BaseRevenue  = FLOOR((Attendance × ticket_price) / 100)
--      FinalRevenue = FLOOR(BaseRevenue × (1 + seating_level × 0.05))
--
--    Economics example (stadium_level=3, seating_level=2, ticket_price=20):
--      Capacity     = 15,000  |  Attendance = 12,000 (80% fill rate)
--      BaseRevenue  = FLOOR((12000 × 20) / 100) = 2,400 FC
--      FinalRevenue = FLOOR(2400 × 1.10)         = 2,640 FC  ← per match
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_ticket_revenue(
  p_team_id      UUID,
  p_ticket_price INT,
  p_attendance   INT    -- raw demand; will be capped by stadium capacity
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_capacity      INT;
  v_seating_level INT;
  v_actual_attend INT;
  v_base_revenue  INT;
  v_final_revenue INT;
BEGIN
  SELECT stadium_level * 5000, COALESCE(seating_level, 1)
    INTO v_capacity, v_seating_level
    FROM public.infrastructure
   WHERE team_id = p_team_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Cap attendance by capacity
  v_actual_attend := LEAST(GREATEST(p_attendance, 0), v_capacity);

  -- Base revenue with /100 divisor (100 fans = 1 FC)
  v_base_revenue := FLOOR((v_actual_attend::FLOAT * GREATEST(p_ticket_price, 0)::FLOAT) / 100.0)::INT;

  -- seating_level multiplier: +5% per level
  v_final_revenue := FLOOR(v_base_revenue::FLOAT * (1.0 + v_seating_level * 0.05))::INT;

  RETURN GREATEST(v_final_revenue, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_ticket_revenue(UUID, INT, INT) TO service_role;

COMMENT ON FUNCTION public.calculate_ticket_revenue IS
  'Computes matchday ticket revenue with seating_level multiplier. '
  'Formula: FLOOR(FLOOR((min(attendance, capacity) × price) / 100) × (1 + seating_level × 0.05)). '
  'The /100 divisor ensures 100k attendees at 20 FC = 20,000 FC not 2,000,000.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS: Block direct client mutations on infrastructure
--    All writes must go through service_role Server Actions.
--    SELECT is allowed so clients can read their own infra (for UI display).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.infrastructure ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read their own team's infrastructure
DROP POLICY IF EXISTS "infra_select_own_team" ON public.infrastructure;
CREATE POLICY "infra_select_own_team"
  ON public.infrastructure
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM public.teams WHERE user_id = auth.uid()
    )
  );

-- UPDATE/INSERT/DELETE: blocked for all non-service_role clients
DROP POLICY IF EXISTS "infra_block_direct_write" ON public.infrastructure;
CREATE POLICY "infra_block_direct_write"
  ON public.infrastructure
  FOR ALL                        -- covers INSERT, UPDATE, DELETE
  USING (false)
  WITH CHECK (false);

-- Also harden players table: users can only read their own team's players
-- (progression_history is now part of this row)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select_own_team" ON public.players;
CREATE POLICY "players_select_own_team"
  ON public.players
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM public.teams WHERE user_id = auth.uid()
    )
  );

-- Players write ops: service_role only (all Server Actions use service_role client)
DROP POLICY IF EXISTS "players_block_direct_write" ON public.players;
CREATE POLICY "players_block_direct_write"
  ON public.players
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMIT;
