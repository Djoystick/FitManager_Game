-- ==========================================================
-- 00028_phase8_w2e_economy.sql
-- Phase 8: Sweat Bank Foundation — W2E Economy Backend
-- Atomic transaction, safe to re-run due to IF NOT EXISTS guards.
-- ==========================================================

BEGIN;

-- ============================================================
-- STEP 1: ENUM for manager profile type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manager_profile_type') THEN
    CREATE TYPE manager_profile_type AS ENUM ('runner', 'lifter', 'yogi', 'ball_player');
  END IF;
END
$$;


-- ============================================================
-- STEP 2: Add new W2E economy columns to public.users
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_profile manager_profile_type NOT NULL DEFAULT 'runner',
  ADD COLUMN IF NOT EXISTS daily_steps     INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_step_sync  DATE                NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS sweat_points    INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cardio_coin     INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fitness_coin    INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ball_coin       INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strength_coin   INTEGER              NOT NULL DEFAULT 0;


-- ============================================================
-- STEP 3: RPC sync_daily_steps
-- Atomically adds steps for a user, enforcing daily hard cap
-- (25,000 steps/day) and crediting Sweat Points via FLOOR math
-- to prevent fractional accumulation exploits.
--
-- Rate: 1000 steps = 100 SP  =>  1 SP per 10 steps
-- Formula: sp_gained = FLOOR(new_steps / 10) - FLOOR(old_steps / 10)
--
-- Returns JSON:
--   { added_steps, sp_gained, total_sp, daily_steps }
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_daily_steps(
  p_user_id   UUID,
  p_steps_to_add INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_steps   INTEGER;
  v_new_steps   INTEGER;
  v_added_steps INTEGER;
  v_sp_gained   INTEGER;
  v_total_sp    INTEGER;
  v_last_sync   DATE;
BEGIN
  -- Lock the row to prevent race conditions / double-spending
  SELECT daily_steps, last_step_sync
    INTO v_old_steps, v_last_sync
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Daily reset: if last sync was before today, zero out step counter
  IF v_last_sync < CURRENT_DATE THEN
    v_old_steps := 0;
  END IF;

  -- Hard cap: maximum 25,000 steps per calendar day
  v_new_steps   := LEAST(v_old_steps + p_steps_to_add, 25000);
  v_added_steps := v_new_steps - v_old_steps;

  -- FLOOR-based SP math: guarantees correct remainder accounting
  -- even when client sends partial batches (e.g. 5 steps at a time)
  v_sp_gained := FLOOR(v_new_steps::NUMERIC / 10)
               - FLOOR(v_old_steps::NUMERIC / 10);

  -- Persist the update atomically
  UPDATE public.users
     SET daily_steps    = v_new_steps,
         last_step_sync = CURRENT_DATE,
         sweat_points   = sweat_points + v_sp_gained
   WHERE id = p_user_id
  RETURNING sweat_points INTO v_total_sp;

  RETURN jsonb_build_object(
    'added_steps', v_added_steps,
    'sp_gained',   v_sp_gained,
    'total_sp',    v_total_sp,
    'daily_steps', v_new_steps
  );
END;
$$;


-- ============================================================
-- STEP 4: RPC convert_sp_to_currency
-- Converts Sweat Points (SP) into one of the four typed coins
-- using an asymmetric multiplier matrix based on the user's
-- manager profile. Enforces balance check before spending.
--
-- Profile → Multiplier matrix:
--   runner:      cardio(1.0) fitness(0.6) ball(0.4) strength(0.2)
--   yogi:        fitness(1.0) cardio(0.6) ball(0.4) strength(0.2)
--   ball_player: ball(1.0) fitness(0.6) strength(0.4) cardio(0.2)
--   lifter:      strength(1.0) ball(0.6) fitness(0.4) cardio(0.2)
--
-- Returns JSON:
--   { sp_spent, gained_coins, currency, new_balance_sp,
--     new_balance_currency }
-- ============================================================

CREATE OR REPLACE FUNCTION public.convert_sp_to_currency(
  p_user_id   UUID,
  p_currency  TEXT,
  p_sp_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile         manager_profile_type;
  v_current_sp      INTEGER;
  v_multiplier      NUMERIC(4,2);
  v_gained_coins    INTEGER;
  v_new_sp          INTEGER;
  v_new_coin_bal    INTEGER;
BEGIN
  -- Validate currency parameter upfront
  IF p_currency NOT IN ('cardio', 'fitness', 'ball', 'strength') THEN
    RAISE EXCEPTION 'Invalid currency type: %. Must be one of: cardio, fitness, ball, strength', p_currency;
  END IF;

  IF p_sp_amount <= 0 THEN
    RAISE EXCEPTION 'sp_amount must be a positive integer, got: %', p_sp_amount;
  END IF;

  -- Lock the row to prevent race conditions
  SELECT manager_profile, sweat_points
    INTO v_profile, v_current_sp
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Check sufficient balance
  IF v_current_sp < p_sp_amount THEN
    RAISE EXCEPTION 'Insufficient Sweat Points. Required: %, Available: %', p_sp_amount, v_current_sp;
  END IF;

  -- Resolve multiplier from the asymmetric matrix
  v_multiplier := CASE v_profile
    WHEN 'runner' THEN
      CASE p_currency
        WHEN 'cardio'    THEN 1.0
        WHEN 'fitness'   THEN 0.6
        WHEN 'ball'      THEN 0.4
        WHEN 'strength'  THEN 0.2
      END
    WHEN 'yogi' THEN
      CASE p_currency
        WHEN 'fitness'   THEN 1.0
        WHEN 'cardio'    THEN 0.6
        WHEN 'ball'      THEN 0.4
        WHEN 'strength'  THEN 0.2
      END
    WHEN 'ball_player' THEN
      CASE p_currency
        WHEN 'ball'      THEN 1.0
        WHEN 'fitness'   THEN 0.6
        WHEN 'strength'  THEN 0.4
        WHEN 'cardio'    THEN 0.2
      END
    WHEN 'lifter' THEN
      CASE p_currency
        WHEN 'strength'  THEN 1.0
        WHEN 'ball'      THEN 0.6
        WHEN 'fitness'   THEN 0.4
        WHEN 'cardio'    THEN 0.2
      END
  END;

  -- FLOOR to prevent fractional coin exploits
  v_gained_coins := FLOOR(p_sp_amount::NUMERIC * v_multiplier);
  v_new_sp       := v_current_sp - p_sp_amount;

  -- Atomic debit SP + credit correct coin column
  IF p_currency = 'cardio' THEN
    UPDATE public.users
       SET sweat_points = v_new_sp,
           cardio_coin  = cardio_coin + v_gained_coins
     WHERE id = p_user_id
    RETURNING cardio_coin INTO v_new_coin_bal;

  ELSIF p_currency = 'fitness' THEN
    UPDATE public.users
       SET sweat_points  = v_new_sp,
           fitness_coin  = fitness_coin + v_gained_coins
     WHERE id = p_user_id
    RETURNING fitness_coin INTO v_new_coin_bal;

  ELSIF p_currency = 'ball' THEN
    UPDATE public.users
       SET sweat_points = v_new_sp,
           ball_coin    = ball_coin + v_gained_coins
     WHERE id = p_user_id
    RETURNING ball_coin INTO v_new_coin_bal;

  ELSIF p_currency = 'strength' THEN
    UPDATE public.users
       SET sweat_points  = v_new_sp,
           strength_coin = strength_coin + v_gained_coins
     WHERE id = p_user_id
    RETURNING strength_coin INTO v_new_coin_bal;
  END IF;

  RETURN jsonb_build_object(
    'sp_spent',             p_sp_amount,
    'gained_coins',         v_gained_coins,
    'currency',             p_currency,
    'multiplier',           v_multiplier,
    'new_balance_sp',       v_new_sp,
    'new_balance_currency', v_new_coin_bal
  );
END;
$$;

COMMIT;
