-- 00018_match_engine.sql (v2 - Enhanced with SELECT FOR UPDATE row locking)

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
    -- ================================================
    -- STEP 1: Lock and fetch the match row atomically
    -- SELECT FOR UPDATE prevents concurrent cron workers
    -- from processing the same match simultaneously.
    -- ================================================
    SELECT home_team_id, away_team_id INTO h_id, a_id
    FROM public.matches
    WHERE id = m_id AND is_simulated = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found or already simulated: %', m_id;
    END IF;

    -- ================================================
    -- STEP 2: Lock & aggregate OVR for starting lineups
    -- FOR UPDATE ensures stamina/ovr values cannot be
    -- modified by training RPCs during calculation.
    -- ================================================
    SELECT COALESCE(SUM(ovr), 0) INTO h_ovr
    FROM public.players
    WHERE team_id = h_id AND lineup_status = 'starting'
    FOR UPDATE;

    SELECT COALESCE(SUM(ovr), 0) INTO a_ovr
    FROM public.players
    WHERE team_id = a_id AND lineup_status = 'starting'
    FOR UPDATE;

    -- Fallback: teams with no lineup set default to 100 aggregate OVR
    IF h_ovr = 0 THEN h_ovr := 100; END IF;
    IF a_ovr = 0 THEN a_ovr := 100; END IF;

    -- ================================================
    -- STEP 3: RNG Luck Factor (0.85x - 1.15x variance)
    -- Each team independently rolls their luck, meaning
    -- a lower-rated team can upset a dominant opponent.
    -- ================================================
    h_luck := 0.85 + (random() * 0.30);
    a_luck := 0.85 + (random() * 0.30);

    h_final := h_ovr * h_luck;
    a_final := a_ovr * a_luck;

    -- ================================================
    -- STEP 4: Advantage Mapping -> Scoreline Generation
    -- Base: Each team independently rolls 0 or 1 goal.
    -- >5% power advantage: +1 to +2 bonus goals (minor edge).
    -- >20% power advantage: +1 to +2 additional goals (dominant).
    -- ================================================
    h_score := FLOOR(random() * 2);
    a_score := FLOOR(random() * 2);

    IF h_final > a_final * 1.05 THEN
        h_score := h_score + 1 + FLOOR(random() * 2);
    ELSIF a_final > h_final * 1.05 THEN
        a_score := a_score + 1 + FLOOR(random() * 2);
    END IF;

    IF h_final > a_final * 1.20 THEN
        h_score := h_score + 1 + FLOOR(random() * 2);
    ELSIF a_final > h_final * 1.20 THEN
        a_score := a_score + 1 + FLOOR(random() * 2);
    END IF;

    -- ================================================
    -- STEP 5: Update match result atomically
    -- ================================================
    UPDATE public.matches
    SET home_score = h_score,
        away_score = a_score,
        is_simulated = TRUE
    WHERE id = m_id;

    -- ================================================
    -- STEP 6: Stamina Drain (15–20 points per player)
    -- Only affects players in the starting 11.
    -- GREATEST(0, ...) prevents stamina going negative.
    -- Rows already locked in STEP 2 via FOR UPDATE.
    -- ================================================
    drain_amount := 15 + FLOOR(random() * 6)::INT;

    UPDATE public.players
    SET stamina = GREATEST(0, stamina - drain_amount)
    WHERE (team_id = h_id OR team_id = a_id)
      AND lineup_status = 'starting';

    -- Return match result summary as JSON
    RETURN json_build_object(
        'home_team_id',   h_id,
        'away_team_id',   a_id,
        'home_score',     h_score,
        'away_score',     a_score,
        'stamina_drained', drain_amount,
        'h_final_power',  ROUND(h_final::NUMERIC, 2),
        'a_final_power',  ROUND(a_final::NUMERIC, 2)
    );
END;
$$ LANGUAGE plpgsql;
