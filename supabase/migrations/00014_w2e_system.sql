-- 00014_w2e_system.sql

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS balance_tp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_steps_logged INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_date DATE;

CREATE OR REPLACE FUNCTION sync_daily_steps(u_id UUID, steps_to_add INT, today_date DATE)
RETURNS INTEGER AS $$
DECLARE
    allowed_steps INT;
    earned_tp INT;
    current_logged INT;
    current_date DATE;
BEGIN
    -- Fetch current state
    SELECT daily_steps_logged, last_sync_date
    INTO current_logged, current_date
    FROM public.users
    WHERE id = u_id;

    -- Reset if new day
    IF current_date IS NULL OR current_date != today_date THEN
        current_logged := 0;
    END IF;

    -- Calculate allowed steps
    allowed_steps := LEAST(steps_to_add, 20000 - current_logged);

    IF allowed_steps <= 0 THEN
        -- If we still need to reset the date but they logged 0 steps:
        UPDATE public.users SET last_sync_date = today_date, daily_steps_logged = current_logged WHERE id = u_id;
        RETURN 0;
    END IF;

    -- Calculate TP (100 steps = 1 TP)
    earned_tp := FLOOR(allowed_steps / 100);

    -- Update user
    UPDATE public.users
    SET 
        daily_steps_logged = current_logged + allowed_steps,
        last_sync_date = today_date,
        balance_tp = balance_tp + earned_tp
    WHERE id = u_id;

    RETURN earned_tp;
END;
$$ LANGUAGE plpgsql;
