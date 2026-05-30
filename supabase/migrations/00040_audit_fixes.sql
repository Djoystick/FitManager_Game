-- =============================================================================
-- Migration: 00040_audit_fixes.sql
-- Purpose:   Closes P0/P1 vulnerabilities found in the Economy & Engine Audit.
-- Changes:
--   1. RPC safe_deduct_treasury      — atomic, overflow-safe Treasury drain
--   2. RPC update_fancoins_after_match — atomic salary+reward FC update (Race Condition fix)
--   3. league_standings.season_reward_paid — idempotency flag (prevents double prize payouts)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ATOMIC TREASURY DRAIN
--    Uses a single UPDATE with GREATEST(0, ...) so the balance can never go
--    negative, even if two cron processes run concurrently.
--    Replaces the read-then-write pattern in end-of-season/route.ts.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION safe_deduct_treasury(deduct_amount NUMERIC)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE treasury
  SET prize_pool_ton = GREATEST(0, prize_pool_ton - deduct_amount)
  WHERE id = 1;
$$;

-- Grant execution to the service role (used by supabaseAdmin client)
GRANT EXECUTE ON FUNCTION safe_deduct_treasury(NUMERIC) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATOMIC FANCOIN TRANSACTION (salary deduction + match reward)
--    Executes both operations as a single SQL statement so no concurrent
--    read-modify-write can interleave and corrupt the balance.
--    Replaces the sequential deductSquadSalary() + awardMatchFc() calls.
--
--    Net delta = reward - salary.
--    GREATEST(0, ...) ensures balance never goes negative.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_fancoins_after_match(
  p_user_id UUID,
  p_salary   INTEGER,
  p_reward   INTEGER
)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE users
  SET balance_fancoins = GREATEST(0, balance_fancoins - p_salary + p_reward)
  WHERE id = p_user_id;
$$;

-- Grant execution to the service role
GRANT EXECUTE ON FUNCTION update_fancoins_after_match(UUID, INTEGER, INTEGER) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. IDEMPOTENCY FLAG — prevents double prize payouts if end-of-season cron
--    is triggered more than once (e.g. after a Vercel timeout retry).
--    Default FALSE → set to TRUE after prizes are successfully distributed.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE league_standings
  ADD COLUMN IF NOT EXISTS season_reward_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast lookup during end-of-season processing
CREATE INDEX IF NOT EXISTS idx_league_standings_reward_paid
  ON league_standings (league_instance_id, season_reward_paid);
