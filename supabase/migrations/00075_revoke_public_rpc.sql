-- =============================================================================
-- Migration: 00075_revoke_public_rpc.sql
-- Purpose:   Security Hardening (P0/P4 fixes)
-- Changes:   Revokes EXECUTE permission from PUBLIC and anon on custom RPCs
--            to prevent unauthenticated SQL execution via PostgREST.
-- =============================================================================

-- It is a best practice to remove PUBLIC execute rights from business logic functions
-- and only grant them to authenticated users or the service_role.

-- Revoke from PUBLIC
REVOKE EXECUTE ON FUNCTION public.get_social_feed(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_manager_xp(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.append_player_progression(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upgrade_stadium_facility(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_ticket_revenue(UUID, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.safe_deduct_treasury(NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_fancoins_after_match(UUID, INTEGER, INTEGER) FROM PUBLIC;

-- Explicitly ensure anon cannot run these either (anon inherits from PUBLIC, but let's be explicit)
REVOKE EXECUTE ON FUNCTION public.get_social_feed(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.award_manager_xp(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.append_player_progression(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upgrade_stadium_facility(UUID, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_ticket_revenue(UUID, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.safe_deduct_treasury(NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_fancoins_after_match(UUID, INTEGER, INTEGER) FROM anon;

-- Ensure service_role retains EXECUTE
GRANT EXECUTE ON FUNCTION public.get_social_feed(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_manager_xp(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_player_progression(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.upgrade_stadium_facility(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_ticket_revenue(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.safe_deduct_treasury(NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_fancoins_after_match(UUID, INTEGER, INTEGER) TO service_role;
