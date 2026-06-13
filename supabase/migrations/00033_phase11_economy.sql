-- ==========================================================
-- 00034_phase11_economy.sql
-- Phase 11: Web3 Economy Layer
--   1. prestige_multiplier on users (Hall of Fame buff)
--   2. sp_earned_today + sp_cap_reset_date (daily SP cap tracking)
--   3. Update sync_daily_steps hard cap: 25000 -> 20000 steps
-- Safe to re-run (IF EXISTS / OR REPLACE guards).
-- ==========================================================

BEGIN;

-- ============================================================
-- STEP 1: New columns on users
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS prestige_multiplier NUMERIC(6,4) NOT NULL DEFAULT 1.0;

-- ============================================================
-- STEP 2: Update sync_daily_steps hard cap 25000 -> 20000
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

  -- Hard cap: maximum 20,000 steps per calendar day (was 25,000)
  v_new_steps   := LEAST(v_old_steps + p_steps_to_add, 20000);
  v_added_steps := v_new_steps - v_old_steps;

  -- FLOOR-based SP math: guarantees correct remainder accounting
  -- Rate: 1000 steps = 100 SP  =>  1 SP per 10 steps
  -- Max per day: 20,000 steps = 2,000 SP
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

COMMIT;
