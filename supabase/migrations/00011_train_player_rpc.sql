-- 00010_train_player_rpc.sql

CREATE OR REPLACE FUNCTION train_player(p_id UUID, u_id UUID, stat_key TEXT, cost INT)
RETURNS void AS $$
BEGIN
    -- Deduct cost, explicitly preventing drop below zero
    UPDATE public.users 
    SET balance_fancoins = balance_fancoins - cost 
    WHERE id = u_id AND balance_fancoins >= cost;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient FanCoins or user not found';
    END IF;

    -- Atomically update stats and recalculate OVR using a CTE
    WITH updated_stats AS (
      SELECT 
        id,
        jsonb_set(stats, ARRAY[stat_key], (COALESCE((stats->>stat_key)::int, 0) + 1)::text::jsonb) as new_stats
      FROM public.players
      WHERE id = p_id
    )
    UPDATE public.players p
    SET 
      stats = u.new_stats,
      ovr = FLOOR(
        (
          COALESCE((u.new_stats->>'pace')::int, 50) +
          COALESCE((u.new_stats->>'shooting')::int, 50) +
          COALESCE((u.new_stats->>'passing')::int, 50) +
          COALESCE((u.new_stats->>'defending')::int, 50) +
          COALESCE((u.new_stats->>'physical')::int, 50)
        ) / 5.0
      )
    FROM updated_stats u
    WHERE p.id = u.id;
END;
$$ LANGUAGE plpgsql;
