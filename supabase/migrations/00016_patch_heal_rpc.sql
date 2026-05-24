-- 00016_patch_heal_rpc.sql

CREATE OR REPLACE FUNCTION heal_player_with_tp(p_id UUID, u_id UUID)
RETURNS void AS $$
BEGIN
    -- Security Check: Prevent arbitrary UUID manipulation
    IF NOT EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.teams t ON p.team_id = t.id
        WHERE p.id = p_id AND t.user_id = u_id
    ) THEN
        RAISE EXCEPTION 'Player does not belong to user';
    END IF;

    -- Atomic check and deduction
    UPDATE public.users
    SET balance_tp = balance_tp - 50
    WHERE id = u_id AND balance_tp >= 50;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient Training Points';
    END IF;

    -- Full Revitalization
    UPDATE public.players
    SET stamina = 100
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
