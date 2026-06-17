-- 00081: Phase 9 — Youth Roster + Staff System Schema
-- Adds youth incubator columns and rebuilds the staff system with roles, slots, and contracts.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. YOUTH ROSTER COLUMNS ON players TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_youth BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_focus TEXT NOT NULL DEFAULT 'balanced'
    CHECK (training_focus IN ('cardio', 'strength', 'ball', 'balanced')),
  ADD COLUMN IF NOT EXISTS youth_joined_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.players.is_youth IS 'true = player is in the youth incubator (age 14-16). false = senior squad.';
COMMENT ON COLUMN public.players.training_focus IS 'Training focus for youth players: cardio (pac/sta), strength (phy/sho), ball (dri/pas), balanced (all).';
COMMENT ON COLUMN public.players.youth_joined_at IS 'Timestamp when youth player joined the academy incubator.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REBUILD staff TABLE (drop old, create new with roles/slots/contracts)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.staff CASCADE;

CREATE TABLE public.staff (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  role              VARCHAR(30) NOT NULL
    CHECK (role IN ('youth_coach', 'head_coach', 'medical_staff', 'head_scout')),
  -- Star rating (1-5) determines quality and salary
  star_rating       INTEGER NOT NULL DEFAULT 1 CHECK (star_rating BETWEEN 1 AND 5),
  -- Coaching attributes (0-99)
  attr_sta          INTEGER NOT NULL DEFAULT 50 CHECK (attr_sta BETWEEN 0 AND 99),
  attr_agi          INTEGER NOT NULL DEFAULT 50 CHECK (attr_agi BETWEEN 0 AND 99),
  attr_ovr_bonus    INTEGER NOT NULL DEFAULT 0 CHECK (attr_ovr_bonus BETWEEN 0 AND 20),
  attr_recovery     INTEGER NOT NULL DEFAULT 0 CHECK (attr_recovery BETWEEN 0 AND 30),
  -- Contract
  contract_weeks    INTEGER NOT NULL DEFAULT 26 CHECK (contract_weeks > 0),
  weeks_remaining   INTEGER NOT NULL DEFAULT 26 CHECK (weeks_remaining >= 0),
  salary_per_week   INTEGER NOT NULL DEFAULT 200 CHECK (salary_per_week >= 0),
  hiring_cost       INTEGER NOT NULL DEFAULT 2000 CHECK (hiring_cost >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_team_id ON public.staff(team_id);
CREATE INDEX IF NOT EXISTS idx_staff_team_active ON public.staff(team_id, is_active);

COMMENT ON TABLE public.staff IS 'Coaching staff with roles, star ratings, and weekly salary contracts.';
COMMENT ON COLUMN public.staff.role IS 'youth_coach: boosts youth growth. head_coach: OVR bonus in matches. medical_staff: passive stamina recovery. head_scout: archetype scouting.';
COMMENT ON COLUMN public.staff.star_rating IS '1-5 stars. Higher = better bonuses but higher salary.';
COMMENT ON COLUMN public.staff.attr_sta IS 'Stamina coaching attribute. Used by youth_coach to boost sta growth.';
COMMENT ON COLUMN public.staff.attr_agi IS 'Agility coaching attribute. Used by youth_coach to boost agi growth.';
COMMENT ON COLUMN public.staff.attr_ovr_bonus IS 'Head coach bonus: +0-20% to team OVR in match engine.';
COMMENT ON COLUMN public.staff.attr_recovery IS 'Medical staff: passive stamina recovery per day (0-30 points).';
COMMENT ON COLUMN public.staff.salary_per_week IS 'Weekly salary in FC. Deducted by salary cron.';
COMMENT ON COLUMN public.staff.hiring_cost IS 'One-time hiring cost in FC.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. STAFF SLOTS — enforced by training_camp_level
-- ═══════════════════════════════════════════════════════════════════════════

-- Max staff slots = training_camp_level (1-10)
-- This is enforced in application code (hireStaffAction), not DB constraint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SYSTEM_CONFIG entries for youth growth and salary crons
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.system_config (key, value) VALUES
  ('last_youth_growth', '1970-01-01T00:00:00Z'),
  ('last_salary_deduction', '1970-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: youth_growth_tick — atomic daily stat growth for youth players
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.youth_growth_tick()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_value TEXT;
  v_last_run TIMESTAMPTZ;
  v_new_timestamp TEXT;
  v_total_youth INT := 0;
  v_total_grown INT := 0;
  v_rec RECORD;
  v_growth INT;
  v_new_stat INT;
  v_new_stats JSONB;
  v_new_ovr INT;
BEGIN
  -- Idempotency lock
  SELECT value INTO v_config_value
  FROM public.system_config WHERE key = 'last_youth_growth';

  IF v_config_value IS NOT NULL THEN
    v_last_run := v_config_value::TIMESTAMPTZ;
    IF EXTRACT(EPOCH FROM (NOW() - v_last_run)) < 20 * 3600 THEN
      RETURN jsonb_build_object('success', true, 'cooldown', true, 'message', 'Already ran recently');
    END IF;
  END IF;

  -- Optimistic lock: write timestamp first
  v_new_timestamp := NOW()::TEXT;
  UPDATE public.system_config SET value = v_new_timestamp WHERE key = 'last_youth_growth';

  -- Process all youth players
  FOR v_rec IN
    SELECT p.id, p.stats, p.ovr, p.training_focus, p.team_id,
           COALESCE(s.attr_sta, 50) AS coach_sta,
           COALESCE(s.attr_agi, 50) AS coach_agi,
           COALESCE(i.academy_level, 1) AS acad_level
    FROM public.players p
    JOIN public.teams t ON t.id = p.team_id
    JOIN public.infrastructure i ON i.team_id = p.team_id
    LEFT JOIN public.staff s ON s.team_id = p.team_id AND s.role = 'youth_coach' AND s.is_active = true
    WHERE p.is_youth = true
  LOOP
    v_total_youth := v_total_youth + 1;

    -- Base growth: 1-3 points per day, scaled by academy level (L1=1, L10=3)
    v_growth := 1 + ((v_rec.acad_level - 1) * 2 / 9)::INT;
    -- Add random variance
    v_growth := v_growth + CASE WHEN random() < 0.3 THEN 1 ELSE 0 END;

    -- Youth coach bonus: +20% growth if coach has high sta/agi
    IF v_rec.coach_sta > 60 THEN
      v_growth := v_growth + 1;
    END IF;
    IF v_rec.coach_agi > 60 THEN
      v_growth := v_growth + 1;
    END IF;

    v_new_stats := v_rec.stats;

    -- Apply growth based on training_focus
    CASE v_rec.training_focus
      WHEN 'cardio' THEN
        -- Boost pac and sta
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'pac')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{pac}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'sta')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{sta}', to_jsonb(v_new_stat));
        -- Small bonus to secondary stats
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'agi')::INT, 50) + (v_growth / 2));
        v_new_stats := jsonb_set(v_new_stats, '{agi}', to_jsonb(v_new_stat));
      WHEN 'strength' THEN
        -- Boost phy and sho
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'phy')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{phy}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'sho')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{sho}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'sta')::INT, 50) + (v_growth / 2));
        v_new_stats := jsonb_set(v_new_stats, '{sta}', to_jsonb(v_new_stat));
      WHEN 'ball' THEN
        -- Boost dri and pas
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'dri')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{dri}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'pas')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{pas}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'agi')::INT, 50) + (v_growth / 2));
        v_new_stats := jsonb_set(v_new_stats, '{agi}', to_jsonb(v_new_stat));
      ELSE -- balanced
        -- Small boost to all 8 stats
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'pac')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{pac}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'sho')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{sho}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'pas')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{pas}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'dri')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{dri}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'def')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{def}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'phy')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{phy}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'sta')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{sta}', to_jsonb(v_new_stat));
        v_new_stat := LEAST(99, COALESCE((v_new_stats->>'agi')::INT, 50) + v_growth);
        v_new_stats := jsonb_set(v_new_stats, '{agi}', to_jsonb(v_new_stat));
    END CASE;

    -- Recalculate OVR from 6 core stats (pac/sho/pas/dri/def/phy)
    v_new_ovr := FLOOR((
      COALESCE((v_new_stats->>'pac')::INT, 50) +
      COALESCE((v_new_stats->>'sho')::INT, 50) +
      COALESCE((v_new_stats->>'pas')::INT, 50) +
      COALESCE((v_new_stats->>'dri')::INT, 50) +
      COALESCE((v_new_stats->>'def')::INT, 50) +
      COALESCE((v_new_stats->>'phy')::INT, 50)
    ) / 6.0);

    UPDATE public.players
    SET stats = v_new_stats, ovr = v_new_ovr
    WHERE id = v_rec.id;

    v_total_grown := v_total_grown + 1;
  END LOOP;

  -- Rollback timestamp on failure (not needed here since we succeed, but pattern consistent)
  RETURN jsonb_build_object(
    'success', true,
    'total_youth', v_total_youth,
    'total_grown', v_total_grown,
    'run_at', NOW()::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.youth_growth_tick() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC: deduct_weekly_salaries — weekly salary deduction for staff
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deduct_weekly_salaries()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_value TEXT;
  v_last_run TIMESTAMPTZ;
  v_new_timestamp TEXT;
  v_total_deducted INT := 0;
  v_total_fired INT := 0;
  v_rec RECORD;
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Idempotency lock (weekly)
  SELECT value INTO v_config_value
  FROM public.system_config WHERE key = 'last_salary_deduction';

  IF v_config_value IS NOT NULL THEN
    v_last_run := v_config_value::TIMESTAMPTZ;
    IF EXTRACT(EPOCH FROM (NOW() - v_last_run)) < 5 * 24 * 3600 THEN
      RETURN jsonb_build_object('success', true, 'cooldown', true, 'message', 'Already ran this week');
    END IF;
  END IF;

  -- Optimistic lock
  v_new_timestamp := NOW()::TEXT;
  UPDATE public.system_config SET value = v_new_timestamp WHERE key = 'last_salary_deduction';

  -- Process all active staff
  FOR v_rec IN
    SELECT s.id, s.team_id, s.salary_per_week, s.contract_weeks, s.weeks_remaining,
           t.user_id
    FROM public.staff s
    JOIN public.teams t ON t.id = s.team_id
    WHERE s.is_active = true AND s.weeks_remaining > 0
  LOOP
    v_user_id := v_rec.user_id;

    -- Read balance
    SELECT balance_fancoins INTO v_balance
    FROM public.users WHERE id = v_user_id FOR UPDATE;

    IF v_balance IS NULL THEN CONTINUE; END IF;

    IF v_balance >= v_rec.salary_per_week THEN
      -- Deduct salary
      v_new_balance := v_balance - v_rec.salary_per_week;
      UPDATE public.users SET balance_fancoins = v_new_balance WHERE id = v_user_id;

      -- Decrement contract
      UPDATE public.staff
      SET weeks_remaining = weeks_remaining - 1
      WHERE id = v_rec.id;

      v_total_deducted := v_total_deducted + 1;
    ELSE
      -- Can't pay — fire the staff member (contract terminated)
      UPDATE public.staff SET is_active = false WHERE id = v_rec.id;
      v_total_fired := v_total_fired + 1;
    END IF;

    -- Check if contract expired
    IF v_rec.weeks_remaining <= 1 THEN
      UPDATE public.staff SET is_active = false WHERE id = v_rec.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_deducted', v_total_deducted,
    'total_fired', v_total_fired,
    'run_at', NOW()::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_weekly_salaries() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RPC: passive_stamina_recovery — daily stamina recovery from medical staff
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.passive_stamina_recovery()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_healed INT := 0;
  v_rec RECORD;
  v_recovery INT;
BEGIN
  -- For each team with active medical_staff
  FOR v_rec IN
    SELECT s.team_id, s.attr_recovery
    FROM public.staff s
    WHERE s.role = 'medical_staff' AND s.is_active = true
  LOOP
    v_recovery := v_rec.attr_recovery;

    -- Heal all players on this team that are below max stamina
    UPDATE public.players
    SET stamina = LEAST(100, stamina + v_recovery)
    WHERE team_id = v_rec.team_id
      AND stamina < 100
      AND is_youth = false;

    v_total_healed := v_total_healed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'teams_healed', v_total_healed,
    'run_at', NOW()::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.passive_stamina_recovery() TO service_role;

COMMIT;
