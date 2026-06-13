-- 00103_security_and_atomicity.sql
-- P0 Security: Enable RLS on core tables + atomic infrastructure upgrade RPC

-- ============================================================
-- 1. ENABLE ROW LEVEL SECURITY ON CRITICAL TABLES
--    No policies = all external access blocked.
--    Server Actions use supabaseAdmin (Service Role) which bypasses RLS.
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

-- Note: `players` and `infrastructure` already have RLS enabled in earlier migrations.
-- This migration ensures the remaining core tables are protected.

-- ============================================================
-- 2. ATOMIC INFRASTRUCTURE UPGRADE RPC
--    Replaces the vulnerable read-modify-write in trainingActions.ts
-- ============================================================

CREATE OR REPLACE FUNCTION public.purchase_infrastructure_upgrade(
    p_team_id UUID,
    p_building_type TEXT,
    p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_column TEXT;
    v_current_level INTEGER;
    v_new_balance NUMERIC;
BEGIN
    -- Resolve column name from building type
    v_column := CASE p_building_type
        WHEN 'stadium'  THEN 'stadium_level'
        WHEN 'medical'  THEN 'medical_center_level'
        WHEN 'academy'  THEN 'academy_level'
        WHEN 'scout'    THEN 'scout_level'
        WHEN 'pitch'    THEN 'pitch_level'
        WHEN 'lighting' THEN 'lighting_level'
        WHEN 'seating'  THEN 'seating_level'
        WHEN 'services' THEN 'services_level'
        ELSE NULL
    END;

    IF v_column IS NULL THEN
        RAISE EXCEPTION 'Invalid building type: %', p_building_type;
    END IF;

    -- Get user_id from team
    SELECT t.user_id INTO v_user_id
    FROM public.teams t
    WHERE t.id = p_team_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    -- Lock user row to prevent race conditions
    PERFORM * FROM public.users WHERE id = v_user_id FOR UPDATE;

    -- Check balance
    IF (SELECT balance_fancoins FROM public.users WHERE id = v_user_id) < p_cost THEN
        RAISE EXCEPTION 'Insufficient FanCoins. Required: %', p_cost;
    END IF;

    -- Deduct balance atomically
    UPDATE public.users
    SET balance_fancoins = balance_fancoins - p_cost
    WHERE id = v_user_id
    RETURNING balance_fancoins INTO v_new_balance;

    -- Read current level
    EXECUTE format(
        'SELECT COALESCE(%I, 1) FROM public.infrastructure WHERE team_id = $1',
        v_column
    ) INTO v_current_level USING p_team_id;

    -- Upsert infrastructure level
    IF v_current_level IS NULL THEN
        EXECUTE format(
            'INSERT INTO public.infrastructure (team_id, %I) VALUES ($1, 2) ON CONFLICT (team_id) DO UPDATE SET %I = 2',
            v_column, v_column
        ) USING p_team_id;
        v_current_level := 1;
    ELSE
        EXECUTE format(
            'UPDATE public.infrastructure SET %I = %I + 1 WHERE team_id = $1',
            v_column, v_column
        ) USING p_team_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_level', v_current_level + 1,
        'new_balance', v_new_balance
    );
END;
$$;
