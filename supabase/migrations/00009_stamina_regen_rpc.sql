-- 00008_stamina_regen_rpc.sql

CREATE OR REPLACE FUNCTION regenerate_stamina()
RETURNS void AS $$
BEGIN
    UPDATE public.players p
    SET stamina = LEAST(100, p.stamina + 30 + (COALESCE(i.medical_center_level, 1) * 10))
    FROM public.infrastructure i
    WHERE p.team_id = i.team_id;
END;
$$ LANGUAGE plpgsql;
