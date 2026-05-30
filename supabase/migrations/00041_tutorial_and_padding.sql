-- =============================================================================
-- Migration: 00041_tutorial_and_padding.sql
-- Purpose:   Adds tutorial progression and TMA padding preference to users.
-- Changes:
--   1. users.tutorial_step        — tracks onboarding step (0-4, -1 = done)
--   2. users.tma_padding_enabled  — TMA fullscreen padding preference
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tutorial step: -1 = completed, 0 = welcome, 1..4 = in-progress
--    NULL means user has never started onboarding (treated same as 0)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tutorial_step INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TMA padding preference — whether to add 60px top padding to avoid
--    Telegram's system UI (close button, three-dots) overlapping content.
--    Default TRUE for safety (better UX on first launch).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tma_padding_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: save_tutorial_step — called after each tutorial step completion.
--    Using SECURITY DEFINER so the anon/authenticated role can update
--    their own row without needing a permissive RLS policy on users.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION save_tutorial_step(p_user_id UUID, p_step INTEGER)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE users
  SET tutorial_step = p_step
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION save_tutorial_step(UUID, INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: save_padding_preference — called from Profile settings toggle.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION save_padding_preference(p_user_id UUID, p_enabled BOOLEAN)
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE users
  SET tma_padding_enabled = p_enabled
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION save_padding_preference(UUID, BOOLEAN) TO service_role;
