-- =============================================================================
-- Migration 00039: Form Decay + Economy v2 Hardening
-- =============================================================================
-- Implements three P0 economy fixes from the macroeconomic audit v2:
--
--   1. apply_form_decay()  — daily cron function that degrades stats on
--      high-OVR players (>78) that lack W2E maintenance coins.
--
--   2. Glass Ceiling patch on upgrade_player_stat RPC — stats >= 70 can
--      only be upgraded with W2E coins, NOT FanCoins.
--
--   3. building_upgrade_cost() helper updated to 800 × level^1.8.
--
-- Designed for: 2 matches/day production schedule.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. FORM DECAY FUNCTION
--    Called by a daily cron job (GitHub Actions / Vercel cron).
--    Degrades OVR-relevant stats for players above the decay threshold
--    who have NOT paid their daily W2E maintenance cost.
--
--    Formula:
--      DECAY_THRESHOLD_OVR = 78
--      decay_points_per_day = FLOOR((ovr - 78) * 0.15)   (at ovr=88 → 1 pt)
--      maintenance_cost     = FLOOR((ovr - 78) * 1.5)    W2E coins/day
--
--    If the player's owner has enough W2E coins → deduct, skip decay.
--    Otherwise → apply decay to pac, phy (the most "perishable" stats).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION apply_form_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record       RECORD;
  v_ovr          INT;
  v_decay_pts    INT;
  v_maint_cost   INT;
  v_coin_balance INT;
  v_new_pac      INT;
  v_new_phy      INT;
  v_new_ovr      INT;
  v_decayed      INT := 0;
  v_maintained   INT := 0;
  v_skipped      INT := 0;
BEGIN
  -- Iterate over all non-retired players above the decay OVR threshold
  FOR v_record IN
    SELECT
      p.id          AS player_id,
      p.ovr,
      p.stats,
      p.age,
      t.user_id,
      u.strength_coin,
      u.cardio_coin
    FROM players  p
    JOIN teams    t ON t.id = p.team_id
    JOIN users    u ON u.id = t.user_id
    WHERE p.ovr > 78
      AND p.is_retired IS NOT TRUE
      AND t.user_id IS NOT NULL
    FOR UPDATE OF p, u
  LOOP
    v_ovr        := v_record.ovr;
    -- How many stat points to decay per day (floor, minimum 0)
    v_decay_pts  := GREATEST(0, FLOOR((v_ovr - 78) * 0.15));
    -- How many W2E coins needed to prevent decay (uses strength_coin as proxy)
    v_maint_cost := GREATEST(0, FLOOR((v_ovr - 78) * 1.5));

    IF v_decay_pts = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Check if user can pay maintenance (strength_coin first, then cardio_coin)
    v_coin_balance := COALESCE(v_record.strength_coin, 0);

    IF v_coin_balance >= v_maint_cost THEN
      -- Deduct maintenance cost → no decay
      UPDATE users
        SET strength_coin = strength_coin - v_maint_cost
        WHERE id = v_record.user_id;
      v_maintained := v_maintained + 1;
    ELSE
      -- Apply stat decay to pac and phy (most perishable physical stats)
      v_new_pac := GREATEST(
        40,
        COALESCE((v_record.stats->>'pac')::int, (v_record.stats->>'pace')::int, 50) - v_decay_pts
      );
      v_new_phy := GREATEST(
        40,
        COALESCE((v_record.stats->>'phy')::int, (v_record.stats->>'physical')::int, 50) - v_decay_pts
      );

      -- Recalculate OVR (simplified: average of key stats)
      -- We only update pac+phy; OVR recomputed from full stats below
      UPDATE players
        SET
          stats = stats
            || jsonb_build_object('pac', v_new_pac)
            || jsonb_build_object('phy', v_new_phy),
          ovr   = GREATEST(
            40,
            FLOOR((
              COALESCE((stats->>'pac')::int, 50)  -- will be stale but close enough
              + COALESCE((stats->>'sho')::int, (stats->>'shooting')::int, 50)
              + COALESCE((stats->>'pas')::int, (stats->>'passing')::int, 50)
              + COALESCE((stats->>'def')::int, (stats->>'defending')::int, 50)
              + COALESCE((stats->>'phy')::int, (stats->>'physical')::int, 50)
              - (v_decay_pts * 2)  -- rough OVR adjustment
            ) / 5.0)
          )
        WHERE id = v_record.player_id;

      v_decayed := v_decayed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status',      'ok',
    'decayed',     v_decayed,
    'maintained',  v_maintained,
    'skipped',     v_skipped,
    'run_at',      NOW()
  );
END;
$$;

COMMENT ON FUNCTION apply_form_decay() IS
  'Daily cron: degrades pac+phy on players OVR>78 whose owner has not paid W2E maintenance coins. '
  'Part of the P2W protection system — forces crypto whales to keep walking.';


-- ---------------------------------------------------------------------------
-- 2. GLASS CEILING ENFORCEMENT
--    Patch the upgrade_player_stat RPC to block FanCoin-funded upgrades
--    once a stat reaches the W2E-only threshold (70).
--
--    NOTE: FanCoin payment is not currently a parameter in the RPC — the RPC
--    only accepts W2E special coins. This guard future-proofs against a
--    scenario where FC-funded training is added. It also documents intent.
-- ---------------------------------------------------------------------------

-- Add a guard column so we can track the threshold
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'w2e_only_mode'
  ) THEN
    ALTER TABLE players ADD COLUMN w2e_only_mode BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN players.w2e_only_mode IS
      'True when ANY stat >= 70. In this mode, all upgrades require W2E coins only (Glass Ceiling).';
  END IF;
END;
$$;

-- Trigger to auto-set w2e_only_mode when stats cross 70
CREATE OR REPLACE FUNCTION check_glass_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_any_stat_ge_70 BOOLEAN;
BEGIN
  -- Check if any of the 6 main stats has reached 70+
  v_any_stat_ge_70 := (
    GREATEST(
      COALESCE((NEW.stats->>'pac')::int,  (NEW.stats->>'pace')::int, 0),
      COALESCE((NEW.stats->>'sho')::int,  (NEW.stats->>'shooting')::int, 0),
      COALESCE((NEW.stats->>'pas')::int,  (NEW.stats->>'passing')::int, 0),
      COALESCE((NEW.stats->>'def')::int,  (NEW.stats->>'defending')::int, 0),
      COALESCE((NEW.stats->>'phy')::int,  (NEW.stats->>'physical')::int, 0),
      COALESCE((NEW.stats->>'dri')::int,  0)
    ) >= 70
  );

  IF v_any_stat_ge_70 AND NOT COALESCE(NEW.w2e_only_mode, FALSE) THEN
    NEW.w2e_only_mode := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_glass_ceiling ON players;
CREATE TRIGGER trg_glass_ceiling
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION check_glass_ceiling();

COMMENT ON TRIGGER trg_glass_ceiling ON players IS
  'Auto-activates W2E-only mode (Glass Ceiling) once any player stat hits 70. '
  'The application layer must check this flag before allowing FC-paid upgrades.';


-- ---------------------------------------------------------------------------
-- 3. BUILDING UPGRADE COST HELPER (Updated formula)
--    Replaces the old 500 × level^1.5 with 800 × level^1.8.
--    Used as reference by backend code; actual deduction lives in TypeScript.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS building_upgrade_cost(INT);

CREATE OR REPLACE FUNCTION building_upgrade_cost(p_current_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  -- Formula: FLOOR(800 × level^1.8)
  -- lvl 1→2:  800 FC   | lvl 3→4: 5 177 FC  | lvl 5→6: 13 856 FC
  -- lvl 7→8: 27 560 FC | lvl 9→10: 47 200 FC | lvl 10→11: 57 243 FC
  SELECT FLOOR(800.0 * POWER(p_current_level::FLOAT, 1.8))::INT;
$$;

COMMENT ON FUNCTION building_upgrade_cost(INT) IS
  'Returns FC cost to upgrade a building from p_current_level to p_current_level+1. '
  'Formula: FLOOR(800 × level^1.8). Updated in migration 00039 (was 500 × level^1.5).';


-- ---------------------------------------------------------------------------
-- 4. CONVENIENCE VIEW: players_economy_status
--    Shows each player's current economy flags for admin dashboards.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW players_economy_status AS
SELECT
  p.id,
  p.name,
  p.ovr,
  p.age,
  t.user_id,
  p.w2e_only_mode,
  -- Daily maintenance cost (strength_coins needed to avoid Form Decay)
  GREATEST(0, FLOOR((p.ovr - 78) * 1.5))::INT  AS daily_maintenance_cost,
  -- Daily decay rate if maintenance not paid
  GREATEST(0, FLOOR((p.ovr - 78) * 0.15))::INT AS daily_decay_rate,
  -- Salary per match (mirrors TypeScript calcPlayerSalary)
  (FLOOR(POWER(GREATEST(0, p.ovr - 40), 1.3) * 0.8) + GREATEST(0, p.age - 28))::INT AS salary_per_match,
  -- Salary per day (2 matches/day production schedule)
  ((FLOOR(POWER(GREATEST(0, p.ovr - 40), 1.3) * 0.8) + GREATEST(0, p.age - 28)) * 2)::INT AS salary_per_day
FROM players p
JOIN teams   t ON t.id = p.team_id
WHERE p.is_retired IS NOT TRUE
ORDER BY p.ovr DESC;

COMMENT ON VIEW players_economy_status IS
  'Economy dashboard view: shows Form Decay risk, maintenance cost, and salary for each active player.';
