-- ==========================================================
-- 00030_phase8_5_tp_cleanup_and_fc_economy.sql
-- Phase 8.5: Drop legacy balance_tp column.
--            Implement award_match_fancoins RPC with
--            exponential building cost reference table.
-- Safe to re-run (IF EXISTS / OR REPLACE guards).
-- ==========================================================

BEGIN;

-- ============================================================
-- STEP 1: Drop obsolete Training Points column
-- ============================================================

ALTER TABLE public.users
  DROP COLUMN IF EXISTS balance_tp;

-- ============================================================
-- STEP 2: award_match_fancoins RPC
--
-- Called by the server after each resolved match.
-- Awards FC to a team's owner based on:
--   Win  = 500 + stadium_level * 75
--   Draw = 250 + stadium_level * 35
--   Loss = 100 + stadium_level * 15
--
-- Uses SELECT ... FOR UPDATE to prevent double-award races.
-- p_result: 'win' | 'draw' | 'loss'
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_match_fancoins(
  p_team_id  UUID,
  p_result   TEXT,        -- 'win' | 'draw' | 'loss'
  p_stadium_level INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id       UUID;
  v_user_row      RECORD;
  v_base_reward   INT;
  v_stadium_bonus INT;
  v_total_reward  INT;
BEGIN
  -- ── 1. Resolve team → user ────────────────────────────────
  SELECT user_id INTO v_user_id
    FROM public.teams
   WHERE id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  -- ── 2. Lock user row ──────────────────────────────────────
  SELECT id, balance_fancoins
    INTO v_user_row
    FROM public.users
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found for team: %', p_team_id;
  END IF;

  -- ── 3. Calculate reward ───────────────────────────────────
  v_base_reward := CASE
    WHEN p_result = 'win'  THEN 500
    WHEN p_result = 'draw' THEN 250
    ELSE                        100   -- loss
  END;

  v_stadium_bonus := CASE
    WHEN p_result = 'win'  THEN p_stadium_level * 75
    WHEN p_result = 'draw' THEN p_stadium_level * 35
    ELSE                        p_stadium_level * 15
  END;

  v_total_reward := v_base_reward + v_stadium_bonus;

  -- ── 4. Credit FanCoins ────────────────────────────────────
  UPDATE public.users
     SET balance_fancoins = balance_fancoins + v_total_reward
   WHERE id = v_user_id;

  -- ── 5. Return result ──────────────────────────────────────
  RETURN jsonb_build_object(
    'user_id',        v_user_id,
    'result',         p_result,
    'base_reward',    v_base_reward,
    'stadium_bonus',  v_stadium_bonus,
    'total_reward',   v_total_reward,
    'new_balance',    v_user_row.balance_fancoins + v_total_reward
  );
END;
$$;

-- ============================================================
-- STEP 3: Grant execute to authenticated role
-- ============================================================

GRANT EXECUTE ON FUNCTION public.award_match_fancoins(UUID, TEXT, INT)
  TO authenticated, service_role;

-- ============================================================
-- STEP 4: building_upgrade_cost helper function
--
-- Centralises the exponential cost formula so it can be
-- called from any context (SQL, triggers, RPC wrappers).
-- Formula: FLOOR(500 * level ^ 1.5)
--
-- level 1  →    500 FC
-- level 2  →  1,414 FC
-- level 3  →  2,598 FC
-- level 5  →  5,590 FC
-- level 10 → 15,811 FC
-- ============================================================

CREATE OR REPLACE FUNCTION public.building_upgrade_cost(p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT FLOOR(500.0 * (p_level::FLOAT) ^ 1.5)::INT;
$$;

GRANT EXECUTE ON FUNCTION public.building_upgrade_cost(INT)
  TO authenticated, service_role, anon;

COMMIT;
