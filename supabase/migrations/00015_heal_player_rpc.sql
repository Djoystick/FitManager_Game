-- 00015_heal_player_rpc.sql

CREATE OR REPLACE FUNCTION heal_player_with_tp(p_id UUID, u_id UUID)
RETURNS void AS $$
BEGIN
    -- Check user balance
    IF (SELECT balance_tp FROM public.users WHERE id = u_id) < 50 THEN
        RAISE EXCEPTION 'Insufficient Training Points';
    END IF;

    -- Verify player ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.teams t ON p.team_id = t.id
        WHERE p.id = p_id AND t.user_id = u_id
    ) THEN
        RAISE EXCEPTION 'Player does not belong to user';
    END IF;

    -- Deduct TP
    UPDATE public.users
    SET balance_tp = balance_tp - 50
    WHERE id = u_id;

    -- Heal Player
    UPDATE public.players
    SET stamina = 100
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
