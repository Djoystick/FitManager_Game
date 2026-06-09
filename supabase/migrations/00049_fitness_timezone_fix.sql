BEGIN;

DROP FUNCTION IF EXISTS public.sync_daily_steps(uuid, integer);

CREATE OR REPLACE FUNCTION public.sync_daily_steps(
  p_user_id   UUID,
  p_total_steps_today INT,
  p_tz_date DATE
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
  -- Lock the row to prevent race conditions
  SELECT daily_steps, last_step_sync
    INTO v_old_steps, v_last_sync
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Daily reset: if last sync was before local today, zero out step counter
  IF v_last_sync IS NULL OR v_last_sync < p_tz_date THEN
    v_old_steps := 0;
  END IF;

  -- If Google Fit somehow goes backwards (glitch), ignore it to prevent negative SP
  IF p_total_steps_today < v_old_steps THEN
    v_new_steps := v_old_steps;
  ELSE
    -- Hard cap: maximum 20,000 steps per calendar day
    v_new_steps := LEAST(p_total_steps_today, 20000);
  END IF;

  v_added_steps := v_new_steps - v_old_steps;

  -- SP Math: 1 SP per 10 steps
  v_sp_gained := FLOOR(v_new_steps::NUMERIC / 10)
               - FLOOR(v_old_steps::NUMERIC / 10);

  -- Prevent negative SP gain
  IF v_sp_gained < 0 THEN
    v_sp_gained := 0;
  END IF;

  -- Persist the update atomically
  UPDATE public.users
     SET daily_steps    = v_new_steps,
         last_step_sync = p_tz_date,
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
