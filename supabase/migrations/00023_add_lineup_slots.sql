-- 00023_add_lineup_slots.sql

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS lineup_slot VARCHAR(20);

CREATE OR REPLACE FUNCTION bulk_update_lineup(payload JSONB)
RETURNS void AS $$
BEGIN
    UPDATE public.players p
    SET 
        lineup_status = data.lineup_status,
        lineup_slot = data.lineup_slot
    FROM jsonb_to_recordset(payload) AS data(id UUID, lineup_status VARCHAR, lineup_slot VARCHAR)
    WHERE p.id = data.id;
END;
$$ LANGUAGE plpgsql;
