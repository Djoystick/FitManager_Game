# Report: Stamina Regeneration & Economy Bugfix

## 1. Economy Bugfix Logic
The match simulation engine (`app/api/cron/league-sim/route.ts`) was previously rewarding all outcomes with the same FanCoin payout. This has been corrected to dynamically calculate rewards based on the match result and the team's Stadium level.

### Exact Code Implementation:
```typescript
const grantReward = async (team: any, resultType: 'win' | 'draw' | 'loss') => {
  const { data: infra } = await supabase.from('infrastructure').select('stadium_level').eq('team_id', team.id).maybeSingle();
  const level = infra ? infra.stadium_level : 1;
  
  let reward = 0;
  if (resultType === 'win') {
    reward = 500 + (level * 100);
  } else if (resultType === 'draw') {
    reward = 150 + (level * 30);
  } else {
    reward = 50 + (level * 10);
  }
  
  const { data: user } = await supabase.from('users').select('balance_fancoins').eq('id', team.user_id).single();
  if (user) {
     await supabase.from('users').update({ balance_fancoins: user.balance_fancoins + reward }).eq('id', team.user_id);
  }
};
```

## 2. Stamina Regeneration (Batch SQL Update)
To prevent Node.js memory bottlenecking when processing thousands of players, Stamina Regeneration was implemented as a server-side PostgreSQL function (RPC).

### Exact Code Implementation (Migration `00008_stamina_regen_rpc.sql`):
```sql
CREATE OR REPLACE FUNCTION regenerate_stamina()
RETURNS void AS $$
BEGIN
    UPDATE public.players p
    SET stamina = LEAST(100, p.stamina + 30 + (COALESCE(i.medical_center_level, 1) * 10))
    FROM public.infrastructure i
    WHERE p.team_id = i.team_id;
END;
$$ LANGUAGE plpgsql;
```

This procedure fetches the `medical_center_level` dynamically from the joined `infrastructure` table. It immediately adds `30` base stamina plus a `10` point bonus per medical center level, while strictly capping the max value to `100` via the `LEAST()` function.

### Cron Endpoint (`app/api/cron/stamina-regen/route.ts`):
The Next.js endpoint now simply acts as a secure trigger for this RPC:
```typescript
export async function GET(req: Request) {
  // ... auth check ...
  const { error: rpcError } = await supabase.rpc("regenerate_stamina");
  // ... response handling ...
}
```
