# Report: Player Training Atomic RPC Fix

## Overview
The application-layer read-modify-write pattern previously used for incrementing player stats exposed a Race Condition. Rapid concurrent training requests could bypass application-layer logic and deduct FanCoins multiple times before the first database mutation committed, potentially overwriting stats due to stale JSONB snapshots.

This vulnerability was resolved by moving the transaction entirely into a PostgreSQL Remote Procedure Call (RPC) using implicit database-level row locking.

## Atomic SQL Transaction (`jsonb_set`)
Below is the core logic inside `00010_train_player_rpc.sql` that guarantees true atomicity:

```sql
    -- Atomically update stats and recalculate OVR using a CTE
    WITH updated_stats AS (
      SELECT 
        id,
        jsonb_set(
          stats, 
          ARRAY[stat_key], 
          (COALESCE((stats->>stat_key)::int, 0) + 1)::text::jsonb
        ) as new_stats
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
```

### Atomicity Guarantees:
1. **FanCoin Deduction Validation**: The `UPDATE public.users` strictly includes a `WHERE balance_fancoins >= cost` check, rolling back the entire transaction instantly if an overdraft occurs.
2. **`jsonb_set` In-Place Mutation**: By resolving the old stat directly inside Postgres `(stats->>stat_key)::int`, we ensure that the increment operation uses the exact row state locked at the instant the query executes, completely circumventing JavaScript snapshot delays.
3. **Frontend Strict Debounce**: We supplement this backend absolute lock with a strict React state debounce (`isTraining`), keeping the button disabled while the initial HTTP request is inflight to avoid slamming the RPC.
