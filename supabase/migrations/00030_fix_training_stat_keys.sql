-- 00031_fix_training_stat_keys.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.upgrade_player_stat(
  p_player_id     UUID,
  p_stat_name     TEXT,
  p_currency_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_row   RECORD;
  v_user_row     RECORD;
  v_team_id      UUID;
  v_user_id      UUID;
  v_legacy_key   TEXT;
  v_current_stat INT;
  v_cost         INT;
  v_required_cur TEXT;
  v_balance      INT;
  v_new_stat     INT;
  v_new_stats    JSONB;
  v_new_ovr      INT;
BEGIN

  -- ── 1. Validate stat name ────────────────────────────────────────────────────
  IF p_stat_name NOT IN ('pac','sta','agi','def','dri','pas','phy','sho') THEN
    RAISE EXCEPTION
      'Invalid stat_name: %. Valid values: pac, sta, agi, def, dri, pas, phy, sho',
      p_stat_name;
  END IF;

  -- ── 2. Validate currency type ────────────────────────────────────────────────
  IF p_currency_type NOT IN ('cardio_coin','fitness_coin','ball_coin','strength_coin') THEN
    RAISE EXCEPTION
      'Invalid currency_type: %. Valid values: cardio_coin, fitness_coin, ball_coin, strength_coin',
      p_currency_type;
  END IF;

  -- ── 3. Enforce stat → currency binding (server-side integrity check) ─────────
  v_required_cur := CASE p_stat_name
    WHEN 'pac' THEN 'cardio_coin'
    WHEN 'sta' THEN 'cardio_coin'
    WHEN 'agi' THEN 'fitness_coin'
    WHEN 'def' THEN 'fitness_coin'
    WHEN 'dri' THEN 'ball_coin'
    WHEN 'pas' THEN 'ball_coin'
    WHEN 'phy' THEN 'strength_coin'
    WHEN 'sho' THEN 'strength_coin'
  END;

  IF v_required_cur <> p_currency_type THEN
    RAISE EXCEPTION
      'Currency mismatch: stat "%" requires %, but received %',
      p_stat_name, v_required_cur, p_currency_type;
  END IF;

  -- ── 4. Lock player row FOR UPDATE (anti-race condition) ──────────────────────
  SELECT id, team_id, stats, ovr
    INTO v_player_row
    FROM public.players
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;

  v_team_id := v_player_row.team_id;

  -- ── 5. Resolve user_id from team ─────────────────────────────────────────────
  SELECT user_id INTO v_user_id
    FROM public.teams
   WHERE id = v_team_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Team not found for player %', p_player_id;
  END IF;

  -- ── 6. Lock user row FOR UPDATE ──────────────────────────────────────────────
  SELECT id, cardio_coin, fitness_coin, ball_coin, strength_coin
    INTO v_user_row
    FROM public.users
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', v_user_id;
  END IF;

  -- ── 7. Extract current stat value from JSONB ─────────────────────────────────
  --       Supports legacy keys for older players to prevent resetting to 50
  v_legacy_key := CASE p_stat_name
    WHEN 'pac' THEN 'pace'
    WHEN 'sho' THEN 'shooting'
    WHEN 'pas' THEN 'passing'
    WHEN 'def' THEN 'defending'
    WHEN 'phy' THEN 'physical'
    ELSE p_stat_name
  END;

  v_current_stat := COALESCE(
    (v_player_row.stats ->> p_stat_name)::INT,
    (v_player_row.stats ->> v_legacy_key)::INT,
    50
  );

  -- ── 8. Progressive "Golden Middle" cost matrix ───────────────────────────────
  v_cost := CASE
    WHEN v_current_stat <= 50 THEN 5
    WHEN v_current_stat <= 65 THEN 10
    WHEN v_current_stat <= 75 THEN 25
    WHEN v_current_stat <= 85 THEN 60
    WHEN v_current_stat <= 90 THEN 120
    ELSE                           300   -- 91-99
  END;

  -- ── 9. Read user balance for the required currency ───────────────────────────
  v_balance := CASE p_currency_type
    WHEN 'cardio_coin'   THEN v_user_row.cardio_coin
    WHEN 'fitness_coin'  THEN v_user_row.fitness_coin
    WHEN 'ball_coin'     THEN v_user_row.ball_coin
    WHEN 'strength_coin' THEN v_user_row.strength_coin
  END;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION
      'Insufficient %. Required: %, Available: %',
      p_currency_type, v_cost, v_balance;
  END IF;

  -- ── 10. Atomic currency debit ─────────────────────────────────────────────────
  IF p_currency_type = 'cardio_coin' THEN
    UPDATE public.users
       SET cardio_coin   = cardio_coin   - v_cost
     WHERE id = v_user_id;

  ELSIF p_currency_type = 'fitness_coin' THEN
    UPDATE public.users
       SET fitness_coin  = fitness_coin  - v_cost
     WHERE id = v_user_id;

  ELSIF p_currency_type = 'ball_coin' THEN
    UPDATE public.users
       SET ball_coin     = ball_coin     - v_cost
     WHERE id = v_user_id;

  ELSIF p_currency_type = 'strength_coin' THEN
    UPDATE public.users
       SET strength_coin = strength_coin - v_cost
     WHERE id = v_user_id;
  END IF;

  -- ── 11. +1 to stat in JSONB ───────────────────────────────────────────────────
  v_new_stat  := v_current_stat + 1;
  v_new_stats := jsonb_set(
    COALESCE(v_player_row.stats, '{}'::JSONB),
    ARRAY[p_stat_name],
    to_jsonb(v_new_stat)
  );

  -- ── 12. Recalculate OVR ───────────────────────────────────────────────────────
  --        Supports both NEW stat keys (pac/sho/pas/def/phy)
  --        and LEGACY keys (pace/shooting/passing/defending/physical).
  --        New keys take precedence.
  v_new_ovr := FLOOR((
    COALESCE(
      (v_new_stats->>'pac')::INT,
      COALESCE((v_new_stats->>'pace')::INT,      50)
    ) +
    COALESCE(
      (v_new_stats->>'sho')::INT,
      COALESCE((v_new_stats->>'shooting')::INT,  50)
    ) +
    COALESCE(
      (v_new_stats->>'pas')::INT,
      COALESCE((v_new_stats->>'passing')::INT,   50)
    ) +
    COALESCE(
      (v_new_stats->>'def')::INT,
      COALESCE((v_new_stats->>'defending')::INT, 50)
    ) +
    COALESCE(
      (v_new_stats->>'phy')::INT,
      COALESCE((v_new_stats->>'physical')::INT,  50)
    )
  ) / 5.0);

  -- ── 13. Persist player update ─────────────────────────────────────────────────
  UPDATE public.players
     SET stats = v_new_stats,
         ovr   = v_new_ovr
   WHERE id = p_player_id;

  -- ── 14. Return result payload ─────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'stat_name',  p_stat_name,
    'old_value',  v_current_stat,
    'new_value',  v_new_stat,
    'cost',       v_cost,
    'currency',   p_currency_type,
    'new_ovr',    v_new_ovr
  );

END;
$$;

COMMIT;
