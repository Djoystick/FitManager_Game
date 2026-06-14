-- =============================================================================
-- Migration 00077: Deep Audit Security Fixes
-- =============================================================================
-- Addresses findings from Deep Audit 2.0:
--   1. Revoke PUBLIC/anon access to increment_fancoins and deduct_fancoins RPCs
--   2. Enable RLS on transfer_market table
--   3. Enable RLS on matches table (legacy, unused but secured)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. REVOKE RPC ACCESS
--    These functions were callable by any anon/authenticated user via PostgREST.
--    Only service_role (server-side) should be able to call them.
-- ---------------------------------------------------------------------------

-- increment_fancoins: Can add unlimited FC to any user (CRITICAL)
REVOKE EXECUTE ON FUNCTION public.increment_fancoins(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_fancoins(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_fancoins(UUID, INT) FROM authenticated;

-- deduct_fancoins: Can force-deduct from any user (HIGH)
REVOKE EXECUTE ON FUNCTION public.deduct_fancoins(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_fancoins(UUID, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_fancoins(UUID, NUMERIC) FROM authenticated;


-- ---------------------------------------------------------------------------
-- 2. ENABLE RLS ON transfer_market
--    RLS was commented out in migration 00003 and never re-enabled.
--    The table is actively used by market/list and market/active routes.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transfer_market'
  ) THEN
    EXECUTE 'ALTER TABLE public.transfer_market ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "transfer_market_select" ON public.transfer_market FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "transfer_market_insert" ON public.transfer_market FOR INSERT WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "transfer_market_update" ON public.transfer_market FOR UPDATE USING (false)';
    EXECUTE 'CREATE POLICY "transfer_market_delete" ON public.transfer_market FOR DELETE USING (false)';
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. ENABLE RLS ON matches (legacy table)
--    RLS was commented out in migration 00001. Table appears unused
--    (superseded by league_matches) but we secure it anyway.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'matches'
  ) THEN
    EXECUTE 'ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY';

    -- Allow public read
    EXECUTE 'CREATE POLICY "matches_select" ON public.matches FOR SELECT USING (true)';

    -- Block direct writes from anon/authenticated
    EXECUTE 'CREATE POLICY "matches_insert" ON public.matches FOR INSERT WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "matches_update" ON public.matches FOR UPDATE USING (false)';
    EXECUTE 'CREATE POLICY "matches_delete" ON public.matches FOR DELETE USING (false)';
  END IF;
END;
$$;
