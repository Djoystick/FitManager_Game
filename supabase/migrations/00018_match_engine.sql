-- 00018_match_engine.sql

CREATE OR REPLACE FUNCTION conduct_match(m_id UUID)
RETURNS JSON AS $$
DECLARE
    h_id UUID;
    a_id UUID;
    h_ovr INT;
    a_ovr INT;
    h_luck FLOAT;
    a_luck FLOAT;
    h_final FLOAT;
    a_final FLOAT;
    h_score INT := 0;
    a_score INT := 0;
    drain_amount INT;
BEGIN
    -- 1. Fetch the match
    SELECT home_team_id, away_team_id INTO h_id, a_id
    FROM public.matches
    WHERE id = m_id AND is_simulated = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found or already simulated';
    END IF;

    -- 2. Fetch OVR for Starting Lineups
    SELECT COALESCE(SUM(ovr), 0) INTO h_ovr FROM public.players WHERE team_id = h_id AND lineup_status = 'starting';
    SELECT COALESCE(SUM(ovr), 0) INTO a_ovr FROM public.players WHERE team_id = a_id AND lineup_status = 'starting';

    IF h_ovr = 0 THEN h_ovr := 100; END IF;
    IF a_ovr = 0 THEN a_ovr := 100; END IF;

    -- 3. Random Factor (Luck +/- 15%)
    h_luck := 0.85 + (random() * 0.30);
    a_luck := 0.85 + (random() * 0.30);

    h_final := h_ovr * h_luck;
    a_final := a_ovr * a_luck;

    -- 4. Map to scores
    h_score := FLOOR(random() * 2); -- Baseline 0 or 1 goal
    a_score := FLOOR(random() * 2);

    IF h_final > a_final * 1.05 THEN
        h_score := h_score + 1 + FLOOR(random() * 2);
    ELSIF a_final > h_final * 1.05 THEN
        a_score := a_score + 1 + FLOOR(random() * 2);
    END IF;

    IF h_final > a_final * 1.2 THEN
        h_score := h_score + 1 + FLOOR(random() * 2);
    ELSIF a_final > h_final * 1.2 THEN
        a_score := a_score + 1 + FLOOR(random() * 2);
    END IF;

    -- 5. Update Match
    UPDATE public.matches
    SET home_score = h_score, away_score = a_score, is_simulated = TRUE
    WHERE id = m_id;

    -- 6. Stamina Drain (15-20 points)
    drain_amount := 15 + FLOOR(random() * 6);
    
    UPDATE public.players
    SET stamina = GREATEST(0, stamina - drain_amount)
    WHERE (team_id = h_id OR team_id = a_id) AND lineup_status = 'starting';

    -- Return JSON result
    RETURN json_build_object(
        'home_team_id', h_id,
        'away_team_id', a_id,
        'home_score', h_score,
        'away_score', a_score,
        'stamina_drained', drain_amount
    );
END;
$$ LANGUAGE plpgsql;
