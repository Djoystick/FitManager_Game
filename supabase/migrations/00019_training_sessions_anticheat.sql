-- 00019_training_sessions_anticheat.sql
-- Proof-of-Effort anti-cheat: training_sessions table + overtraining penalty trigger

-- ================================================
-- TABLE: training_sessions
-- Stores each discrete workout session submitted
-- via the W2E step-sync pipeline. Used for Proof-of-
-- Effort validation and duplicate/fraud detection.
-- ================================================
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- MET (Metabolic Equivalent of Task) value for the reported activity type.
    -- Typical: walking=3.5, running=8.0, cycling=6.0. Used for effort validation.
    met_value       NUMERIC(4,1) NOT NULL CHECK (met_value > 0),
    
    -- Duration submitted by the client (in minutes).
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    
    -- Steps logged in this session (anti-duplication cross-reference).
    steps_logged    INTEGER NOT NULL DEFAULT 0 CHECK (steps_logged >= 0),
    
    -- TP earned from this session after validation and penalty application.
    tp_earned       INTEGER NOT NULL DEFAULT 0,
    
    -- Penalty multiplier applied (1.0 = no penalty, 0.9 = 10% penalty, etc.).
    -- Stored for auditability / debugging.
    penalty_factor  NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    
    -- Validation status: 'pending', 'approved', 'rejected', 'penalized'.
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'penalized')),
    
    -- ISO 8601 date the session was submitted.
    session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast per-user session lookups and daily duplicate detection.
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date
    ON public.training_sessions(user_id, session_date);

-- ================================================
-- FUNCTION: apply_overtraining_penalty
-- Checks how many sessions the user has already
-- approved on session_date. Each additional session
-- beyond the first incurs a cumulative -10% TP penalty.
--
-- Penalty Formula:
--   factor = GREATEST(0.0, 1.0 - (prior_sessions * 0.10))
--   tp_earned = FLOOR(base_tp * factor)
--
-- Examples:
--   1st session: 100% TP (no penalty)
--   2nd session:  90% TP (-10%)
--   3rd session:  80% TP (-20%)
--   11th+ session: 0% TP (fully exhausted)
-- ================================================
CREATE OR REPLACE FUNCTION apply_overtraining_penalty(
    p_user_id       UUID,
    p_session_date  DATE,
    p_base_tp       INT,
    p_met           NUMERIC,
    p_duration      INT,
    p_steps         INT
)
RETURNS TABLE(
    earned_tp       INT,
    factor          NUMERIC,
    session_status  VARCHAR
) AS $$
DECLARE
    prior_sessions  INT;
    penalty_factor  NUMERIC(3,2);
    final_tp        INT;
    v_status        VARCHAR(20);
BEGIN
    -- Count approved sessions on this date (excluding 'rejected').
    SELECT COUNT(*) INTO prior_sessions
    FROM public.training_sessions
    WHERE user_id = p_user_id
      AND session_date = p_session_date
      AND status IN ('approved', 'penalized');

    -- Compute penalty factor: 10% per prior session, floor at 0.
    penalty_factor := GREATEST(0.00, 1.00 - (prior_sessions * 0.10));
    final_tp       := FLOOR(p_base_tp * penalty_factor);

    -- Determine status
    IF penalty_factor = 0.00 THEN
        v_status := 'rejected';
    ELSIF penalty_factor < 1.00 THEN
        v_status := 'penalized';
    ELSE
        v_status := 'approved';
    END IF;

    -- Insert the session record for full auditability
    INSERT INTO public.training_sessions
        (user_id, met_value, duration_minutes, steps_logged, tp_earned, penalty_factor, status, session_date)
    VALUES
        (p_user_id, p_met, p_duration, p_steps, final_tp, penalty_factor, v_status, p_session_date);

    RETURN QUERY SELECT final_tp, penalty_factor, v_status;
END;
$$ LANGUAGE plpgsql;
