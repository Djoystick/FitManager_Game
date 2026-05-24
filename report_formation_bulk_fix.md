# Report: Formation Bulk Commit Refactor

## Anti-Pattern Resolved
Previously, adjusting a formation required executing 16 independent database `UPDATE` promises concurrently to map every player to their correct `lineup_status` (starting or bench). While functionally correct via `Promise.all()`, this approach forced the Node.js backend to hold 16 separate active connections to PostgreSQL simultaneously, creating a severe bottleneck and risking connection pool exhaustion at scale.

## The Atomic Bulk Strategy
This anti-pattern was eradicated by passing the entire 16-player state transition payload into a single, specialized Remote Procedure Call (`bulk_update_lineup`).

### 1. Database Level (PostgreSQL RPC)
A custom PL/pgSQL function was written inside migration `00013_bulk_update_lineup_rpc.sql` to unpack a JSONB array and execute the updates natively:

```sql
CREATE OR REPLACE FUNCTION bulk_update_lineup(payload JSONB)
RETURNS void AS $$
BEGIN
    UPDATE public.players p
    SET lineup_status = data.lineup_status
    FROM jsonb_to_recordset(payload) AS data(id UUID, lineup_status VARCHAR)
    WHERE p.id = data.id;
END;
$$ LANGUAGE plpgsql;
```
By utilizing `jsonb_to_recordset`, the database treats the JSON payload as an ephemeral table and seamlessly joins it against the `players` table, updating all 16 rows internally in roughly the same time it would take to update a single row over the network.

### 2. Application Level (`route.ts`)
The API now condenses the data array and executes exactly 1 network request:

```typescript
// 1. Prepare minimal JSONB payload for bulk RPC
const payload = playersToUpdate.map(p => ({
  id: p.id,
  lineup_status: p.lineup_status
}));

// 2. Execute single bulk operation via RPC to prevent connection pool exhaustion
const { error: bulkError } = await supabase.rpc('bulk_update_lineup', { payload });
```

This ensures extreme scalability and absolute transactional safety.
