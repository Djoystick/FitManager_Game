-- 00013_bulk_update_lineup_rpc.sql

CREATE OR REPLACE FUNCTION bulk_update_lineup(payload JSONB)
RETURNS void AS $$
BEGIN
    UPDATE public.players p
    SET lineup_status = data.lineup_status
    FROM jsonb_to_recordset(payload) AS data(id UUID, lineup_status VARCHAR)
    WHERE p.id = data.id;
END;
$$ LANGUAGE plpgsql;
