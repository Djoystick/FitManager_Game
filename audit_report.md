# 🔍 FitManager — Аудит Движка и Экономики

> **Дата аудита:** 2026-05-30  
> **Аудитор:** Senior Game Economy & Engine Analyst  
> **Целевые файлы:** `process-matches`, `end-of-season`, `league-autofill`, `calendarActions`, `matchActions`, `matchEngine`

---

## 1. Executive Summary

| Система | Статус | Уровень угрозы |
|---|---|---|
| Treasury Drain / TON Prize Pool | ⚠️ Уязвима | 🟡 ЖЁЛТЫЙ |
| FanCoins Инфляция | ⚠️ Уязвима | 🟡 ЖЁЛТЫЙ |
| Quick Sell Exploit | ✅ Не обнаружен* | 🟢 ЗЕЛЁНЫЙ |
| Deadlock лиг (process-matches) | 🔴 Критично | 🔴 КРАСНЫЙ |
| Cron Chain Timeout | 🔴 Критично | 🔴 КРАСНЫЙ |
| Эпидемия травм / пустой состав | ⚠️ Уязвима | 🟡 ЖЁЛТЫЙ |
| Отрицательная стамина | ✅ Защищена | 🟢 ЗЕЛЁНЫЙ |
| Race Condition (двойной drain Treasury) | 🔴 Критично | 🔴 КРАСНЫЙ |
| Auth bypass в league-autofill | 🔴 Критично | 🔴 КРАСНЫЙ |
| `simulateNextPendingMatch` Dummy Match Exploit | 🔴 Критично | 🔴 КРАСНЫЙ |

**Итого: 4 критических уязвимости, 3 жёлтых риска.**

---

## 2. Risk Assessment

### 🔴 РИСК-1 — Cron Chain Timeout (Vercel Soft-lock)
**Файл:** `process-matches/route.ts`, строки 71–81

**Проблема:**  
`process-matches` вызывает `end-of-season` через `await fetch(...)`, а затем `await fetch(...)` на `league-autofill` — **последовательно и синхронно**.

`end-of-season` итерирует по **всем** активным инстансам, для каждого делает:
- `SELECT count` неыгранных матчей
- `SELECT` standings (14 записей)
- `UPDATE` instance status
- 14× `SELECT team + user` + `UPDATE user balance` + `sendTelegramMessage` (каждая — HTTP-запрос!)
- 14× `INSERT league_standings`

При 50 одновременно завершающихся лигах это **700+ DB-вызовов + 700+ Telegram HTTP-запросов** в одной цепочке. Vercel Hobby: 10s лимит. Pro: 60s. Это **гарантированный таймаут**.

**Последствие (Soft-lock):** `process-matches` падает по таймауту. Все матчи этого тура остаются в статусе `pending`, но часть уже `completed`. Следующий вызов cron найдёт тот же `targetRound`, попытается сыграть уже сыгранные матчи (они защищены проверкой `is_played`), но `end-of-season` снова запустится — и снова упадёт. **Игра заморожена навсегда.**

---

### 🔴 РИСК-2 — Race Condition: двойное списание из Treasury
**Файл:** `end-of-season/route.ts`, строки 75–88 и 150–153

**Проблема:**  
Treasury читается **один раз в начале** (строка 75: `currentPool`), а потом используется для расчёта всех призов всех инстансов в цикле. При следующей итерации цикла `currentPool` уже устарел.

```
Итерация 1 (Tier 1): currentPool = 1000 TON → drain 10% = 100 TON → usedTon=100
Итерация 2 (Tier 1): currentPool = 1000 TON (СТАРОЕ ЗНАЧЕНИЕ!) → drain 10% = 100 TON → usedTon=100
...
Итерация N (Tier 1): currentPool = 1000 TON → drain 100 TON
```

Реальное списание: 100 TON × N, но Treasury уменьшится только один раз (на последнем UPDATE). Если потом придёт второй экземпляр cron — он прочитает тот же `prize_pool_ton` и снова нарежет 100 TON.

**В строке 150–152** есть `Math.max(0, safePool - usedTon)` — это частично защищает от отрицательного баланса. Но `safePool` — **повторное чтение из БД**, которое прочтёт значение до предыдущего UPDATE текущего запроса (нет транзакций!). Два параллельных cron-вызова могут оба прочитать одно значение и оба вычесть — итого вычтут в 2× больше, чем должны.

---

### 🔴 РИСК-3 — Auth Bypass в league-autofill
**Файл:** `league-autofill/route.ts`, строки 27–31

```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  console.warn("Unauthorized cron attempt");
  // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); ← ЗАКОММЕНТИРОВАНО!
}
```

Строка `return` закомментирована! Любой человек, знающий URL эндпоинта, может вызвать `league-autofill` без авторизации. Это создаёт **бесплатных пользователей и команды** в базе данных по требованию.

**Эксплойт:** Злоумышленник флудит `GET /api/cron/league-autofill` → создаётся неограниченное количество bot-users, bot-teams, players в БД → database bloat → деградация производительности для всех игроков.

---

### 🔴 РИСК-4 — Dummy Match Exploit в simulateNextPendingMatch
**Файл:** `matchActions.ts`, строки 578–610

```typescript
if (!userMatch) {
  // ...
  const { data: newMatch } = await supabaseAdmin
    .from('league_matches')
    .insert({
      home_team_id: teamData.id,
      away_team_id: randomTeam.id,
      league_id: randomTeam.league_id || null,
      round_number: 999,
      status: 'pending',
    })
```

Если у пользователя нет pending-матча, система **создаёт фиктивный матч** против случайной команды. Затем этот матч разыгрывается через `resolveMatch`, что приводит к:
1. Начислению FanCoins победителю (500–800 FC)
2. Обновлению standings случайной команды из ДРУГОЙ лиги
3. Возможно, матч round 999 будет обнаружен `end-of-season` как unplayed (`is_played: false`) и заблокирует финализацию инстанса навсегда

**Это бесплатный FC-фарм через UI без ограничений.**

---

### 🟡 РИСК-5 — Treasury Inflation при масштабировании (100 лиг Tier 10)
**Файл:** `end-of-season/route.ts`, строки 78–88

Tiers 8-10: `drainPercentage = 0`. Они не дренируют Treasury — ок.  
Но Tier 1: `drainPercentage = 0.10` (10%).

Сценарий: 10 одновременно завершающихся лиг Tier 1. Каждая читает `currentPool` в начале своей обработки внутри **одного** цикла `for`. Однако, поскольку `currentPool` читается **вне** цикла (строка 75 — **внутри** `for` по `instance`), каждая итерация читает Treasury заново. Это частично защищает... но не от параллельных cron-запросов.

**Дополнительный баг:** FC-награды для Tier 10:
```
position 1: 15000 + (11 - 10) * 2000 = 17000 FC
```
Для Tier 1:
```
position 1: 15000 + (11 - 1) * 2000 = 35000 FC
```
35 000 FC за 1 сезон в Tier 1 — разумно. Но если cron зациклится (РИСК-1), игрок получит 35 000 FC × N итераций. Необходима идемпотентная защита.

---

### 🟡 РИСК-6 — FanCoins Double Award (salary → award порядок)
**Файл:** `matchActions.ts`, строки 438–495

В `resolveMatch` порядок операций:
1. `deductSquadSalary(homePlayersData, ...)` — списывает зарплату
2. `awardMatchFc(...)` — начисляет за победу

Обе функции читают `balance_fancoins` независимо, без транзакции. При параллельном вызове (например, UI-кнопка + cron одновременно) возможна классическая read-modify-write race condition. Один update перезапишет другой.

**Пример:**
```
T1: deductSquadSalary читает balance = 1000, вычитает 200 → пишет 800
T2: awardMatchFc читает balance = 1000 (до записи T1!) → добавляет 500 → пишет 1500
Итог: 1500 вместо 1300. Игрок получил зарплату бесплатно.
```

---

### 🟡 РИСК-7 — Эпидемия травм: команда без стартового состава
**Файл:** `matchActions.ts`, строки 209–246

`getSquad` корректно обрабатывает случай `starters.length < 11` через fallback. **Технический форфейт** (3:0) выдаётся при < 11 здоровых игроков в стартовом составе.

**НО:** В `calendarActions.ts` (старый `simulateNextRound`) травмы применяются только к `starting`+`is_injured: false` игрокам. Если травмируется весь стартовый состав из 11 человек, у менеджера нет **механизма замены** — он не может сменить lineup_status. Движок выдаст форфейт 0:3 на каждый оставшийся матч сезона. Это не краш, но **геймплейный dead-end** для пользователя.

---

### 🟢 РИСК-8 — Отрицательная стамина (НЕ ОБНАРУЖЕНА)
В `matchEngine.ts` строка 231: `Math.max(0, p.stamina - finalDrain)` — защита есть.  
В `matchActions.ts` строка 338: `Math.max(0, newStam)` — защита есть.  
В `calendarActions.ts` строка 161: `Math.max(0, p.stamina - decay)` — защита есть.  
**Риск закрыт.** ✅

---

## 3. Remediation Plan

| # | Приоритет | Действие | Файл |
|---|---|---|---|
| R1 | 🔴 P0 | Сделать вызовы end-of-season и autofill fire-and-forget (не await) | `process-matches/route.ts` |
| R2 | 🔴 P0 | Добавить Idempotency Guard в end-of-season (проверка что instance уже `finished`) | `end-of-season/route.ts` |
| R3 | 🔴 P0 | Восстановить return на unauthorized в league-autofill | `league-autofill/route.ts` |
| R4 | 🔴 P0 | Удалить или защитить dummy match в simulateNextPendingMatch | `matchActions.ts` |
| R5 | 🟡 P1 | Добавить Treasury snapshot + atomic drain с MIN(drain, safePool/N) | `end-of-season/route.ts` |
| R6 | 🟡 P1 | Объединить salary deduct и FC award в одну атомарную rpc-функцию | `matchActions.ts` |
| R7 | 🟡 P2 | Добавить UI-подсказку/механизм когда весь стартовый состав травмирован | Фронтенд / `matchActions.ts` |

---

## 4. Код исправлений

---

### Fix R1 — Fire-and-forget для cron-цепочки
**Файл:** `app/api/cron/process-matches/route.ts`

```typescript
// БЫЛО (блокирующий await — вызывает таймаут):
await fetch(`${baseUrl}/api/cron/end-of-season`, { ... });
await fetch(`${baseUrl}/api/cron/league-autofill`, { ... });

// СТАЛО (fire-and-forget — не ждём ответа):
fetch(`${baseUrl}/api/cron/end-of-season`, {
  headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
}).catch(e => console.error('[process-matches] end-of-season fire-and-forget error:', e));

fetch(`${baseUrl}/api/cron/league-autofill`, {
  headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
}).catch(e => console.error('[process-matches] autofill fire-and-forget error:', e));
```

> [!IMPORTANT]
> На Vercel Edge/Serverless fire-and-forget без `waitUntil` может быть убит раньше завершения.
> Если используется Vercel с поддержкой `waitUntil`, оберните так:
> ```typescript
> import { waitUntil } from '@vercel/functions';
> waitUntil(fetch(`${baseUrl}/api/cron/end-of-season`, { ... }));
> waitUntil(fetch(`${baseUrl}/api/cron/league-autofill`, { ... }));
> ```

---

### Fix R2 — Idempotency Guard + атомарный Treasury Drain
**Файл:** `app/api/cron/end-of-season/route.ts`

```typescript
// ШАГ 0: Фильтровать только active инстансы у которых ВСЕ матчи сыграны
// (уже есть) — но добавить защиту от двойного выполнения через статус

// Внутри цикла for (const instance of activeInstances):

// БЫЛО: нет проверки
// СТАЛО: проверяем статус ещё раз атомарно (оптимистическая блокировка)
const { data: updated, error: lockError } = await supabaseAdmin
  .from('league_instances')
  .update({ status: 'finishing' })   // промежуточный статус
  .eq('id', instance.id)
  .eq('status', 'active')            // CAS: обновим ТОЛЬКО если статус всё ещё active
  .select('id')
  .maybeSingle();

if (lockError || !updated) {
  console.log(`[CRON EndOfSeason] Instance ${instance.id} already being processed, skipping.`);
  continue; // другой процесс уже взял этот инстанс
}

// ... далее вся логика призов ...

// В конце — устанавливаем финальный статус
await supabaseAdmin
  .from('league_instances')
  .update({ status: 'finished' })
  .eq('id', instance.id);
```

```typescript
// Treasury Drain — атомарный расчёт с защитой от овердрафта
// БЫЛО: читаем pool один раз ВНЕ цикла, используем устаревшее значение
// СТАЛО: читаем pool ВНУТРИ каждой итерации + вычитаем только реально розданное

// В начале итерации:
const { data: freshTreasury } = await supabaseAdmin
  .from('treasury')
  .select('prize_pool_ton')
  .eq('id', 1)
  .single();
const currentPool = freshTreasury?.prize_pool_ton ?? 0;

// После расчёта usedTon:
if (usedTon > 0) {
  // Атомарный UPDATE с защитой от отрицательного баланса
  await supabaseAdmin.rpc('safe_deduct_treasury', {
    deduct_amount: usedTon
  });
  // Функция в БД (добавить в migration):
  // CREATE OR REPLACE FUNCTION safe_deduct_treasury(deduct_amount NUMERIC)
  // RETURNS void AS $$
  //   UPDATE treasury
  //   SET prize_pool_ton = GREATEST(0, prize_pool_ton - deduct_amount)
  //   WHERE id = 1;
  // $$ LANGUAGE SQL;
}
```

**SQL для миграции:**
```sql
-- supabase/migrations/00040_safe_treasury_drain.sql
CREATE OR REPLACE FUNCTION safe_deduct_treasury(deduct_amount NUMERIC)
RETURNS void
LANGUAGE SQL
AS $$
  UPDATE treasury
  SET prize_pool_ton = GREATEST(0, prize_pool_ton - deduct_amount)
  WHERE id = 1;
$$;
```

---

### Fix R3 — Восстановить Auth в league-autofill
**Файл:** `app/api/cron/league-autofill/route.ts`

```typescript
// БЫЛО (return закомментирован!):
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  console.warn("Unauthorized cron attempt");
  // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// СТАЛО:
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  console.warn("[AutoFill] Unauthorized cron attempt blocked.");
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

### Fix R4 — Удалить Dummy Match Exploit
**Файл:** `app/actions/matchActions.ts`

```typescript
// БЫЛО: создаёт фиктивный матч round:999 против случайной команды
// СТАЛО: просто сообщить что матчей нет

export async function simulateNextPendingMatch(userId: string) {
  try {
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams').select('id').eq('user_id', userId).single();

    if (teamError || !teamData) {
      return { success: false, error: 'Team not found' };
    }

    const { data: userMatch } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('status', 'pending')
      .or(`home_team_id.eq.${teamData.id},away_team_id.eq.${teamData.id}`)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!userMatch) {
      // ❌ НЕ создаём dummy матч. Просто возвращаем ошибку.
      return { success: false, error: 'No pending matches found for your team. Wait for the cron to process the next round.' };
    }

    const roundNumber = userMatch.round_number;
    const { data: roundMatches } = await supabaseAdmin
      .from('league_matches')
      .select('id')
      .eq('status', 'pending')
      .eq('round_number', roundNumber);

    if (!roundMatches || roundMatches.length === 0) {
      return { success: false, error: 'Failed to fetch round matches' };
    }

    for (const rm of roundMatches) {
      await resolveMatch(rm.id);
    }

    revalidatePath('/', 'page');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown exception' };
  }
}
```

---

### Fix R5 — Добавить FC-инфляционный лимит в end-of-season
**Файл:** `app/api/cron/end-of-season/route.ts`

```typescript
// Защита от повторного начисления FC при перезапуске cron:
// Добавить поле `season_reward_paid: boolean` в таблицу league_standings
// и проверять его перед начислением.

// В цикле по finalStandings:
const { data: standingRecord } = await supabaseAdmin
  .from('league_standings')
  .select('season_reward_paid')
  .eq('team_id', finalStandings[i].team_id)
  .eq('league_instance_id', instance.id)
  .single();

if (standingRecord?.season_reward_paid) {
  console.log(`[EndOfSeason] Team ${finalStandings[i].team_id} already rewarded, skipping.`);
  continue;
}

// ... начисление призов ...

// После начисления — помечаем как выплаченное:
await supabaseAdmin
  .from('league_standings')
  .update({ season_reward_paid: true })
  .eq('team_id', finalStandings[i].team_id)
  .eq('league_instance_id', instance.id);
```

**SQL для миграции:**
```sql
-- supabase/migrations/00040_safe_treasury_drain.sql (добавить к файлу выше)
ALTER TABLE league_standings
  ADD COLUMN IF NOT EXISTS season_reward_paid BOOLEAN NOT NULL DEFAULT FALSE;
```

---

### Fix R6 — Атомарный salary+award через RPC
**Файл:** `app/actions/matchActions.ts`

Для закрытия race condition в FC-балансе необходимо объединить deduct и award в **одну SQL-функцию**:

```sql
-- supabase/migrations/00041_atomic_fc_update.sql
CREATE OR REPLACE FUNCTION update_fancoins_after_match(
  p_user_id UUID,
  p_salary   INTEGER,
  p_reward   INTEGER
)
RETURNS void
LANGUAGE SQL
AS $$
  UPDATE users
  SET balance_fancoins = GREATEST(0, balance_fancoins - p_salary + p_reward)
  WHERE id = p_user_id;
$$;
```

```typescript
// В matchActions.ts — заменить последовательные deductSquadSalary + awardMatchFc
// на единый вызов для каждого пользователя:
const applyFcTransaction = async (teamId: string, players: any[], gf: number, ga: number) => {
  const { data: teamData } = await supabaseAdmin.from('teams').select('user_id').eq('id', teamId).maybeSingle();
  if (!teamData?.user_id) return;

  // Рассчитываем salary
  const salary = players.reduce((sum, p) => sum + calcPlayerSalary(Number(p.ovr ?? 55), Number(p.age ?? 25)), 0);

  // Рассчитываем reward
  const { data: infra } = await supabaseAdmin.from('infrastructure').select('stadium_level').eq('team_id', teamId).maybeSingle();
  const stadiumLevel = infra?.stadium_level ?? 1;
  const matchResult = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
  let baseReward = matchResult === 'win' ? 500 : matchResult === 'draw' ? 250 : 100;
  let levelBonus = matchResult === 'win' ? 150 : matchResult === 'draw' ? 70 : 30;

  const { data: userData } = await supabaseAdmin.from('users').select('prestige_multiplier').eq('id', teamData.user_id).maybeSingle();
  const multiplier = Number(userData?.prestige_multiplier ?? 1.0);
  const reward = Math.floor((baseReward + stadiumLevel * levelBonus) * multiplier);

  // Единый атомарный вызов
  await supabaseAdmin.rpc('update_fancoins_after_match', {
    p_user_id: teamData.user_id,
    p_salary: salary,
    p_reward: reward
  });

  console.log(`[resolveMatch] FC transaction for team ${teamId}: -${salary} salary, +${reward} reward (${matchResult})`);
};

await applyFcTransaction(match.home_team_id, homePlayersData, result.score.home, result.score.away);
await applyFcTransaction(match.away_team_id, awayPlayersData, result.score.away, result.score.home);
```

---

### Fix R7 — Геймплейная защита: уведомление при полностью травмированном составе
**Файл:** `app/actions/matchActions.ts` (внутри `getSquad`)

```typescript
// Добавить флаг предупреждения который передаётся наружу
const getSquad = (players: any[]) => {
  let starters = players.filter(p => p.lineup_slot !== null && parseInt(p.lineup_slot) <= 10 && !p.is_injured);
  let bench = players.filter(p => (p.lineup_status === 'bench' || p.lineup_status === 'reserve') && !p.is_injured);

  const healthyStarterCount = starters.length;

  if (starters.length < 11) {
    console.warn(`[resolveMatch] Lineup incomplete (${starters.length} healthy starters). Using best available fallback.`);
    // Fallback: берём лучших здоровых игроков включая скамейку
    const allHealthy = players.filter(p => !p.is_injured).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const gks = allHealthy.filter(p => p.position === 'GK');
    const fields = allHealthy.filter(p => p.position !== 'GK');

    if (gks.length > 0) {
      starters = [gks[0], ...fields.slice(0, 10)];
    } else {
      starters = allHealthy.slice(0, 11);
    }
    bench = [];
  }

  return { starters, bench: bench.slice(0, 7), healthyStarterCount };
};
```

---

## 5. Дополнительные наблюдения (Low Severity)

### L1 — calendarActions.ts: `simulateNextRound` без league_instance_id фильтра
В `calendarActions.ts` строка 126: `supabaseAdmin.from('league_standings').select('*')` — без `WHERE`. Это загружает standings **всех** лиг в память. При росте до 1000+ лиг — OOM или таймаут. Добавить фильтр по `league_instance_id`.

### L2 — `generateLeagueSchedule`: дублирование матчей при повторном вызове
В `league-autofill` строки 157–162: если лига уже полна но статус не обновлён, вызывается `generateLeagueSchedule` снова. Нет проверки на существующие матчи. Добавить:
```typescript
const { count: existingMatches } = await supabaseAdmin
  .from('league_matches')
  .select('*', { count: 'exact', head: true })
  .eq('league_instance_id', instance.id);

if (!existingMatches || existingMatches === 0) {
  await generateLeagueSchedule(instance.id);
}
```

### L3 — end-of-season: standings не фильтруются по league_instance_id в updateStandings
В `matchActions.ts` строка 351: `.eq('team_id', teamId).single()` — если команда участвует в нескольких исторических лигах, `.single()` упадёт с ошибкой. Должен быть фильтр по `league_instance_id`.

```typescript
// БЫЛО:
const { data: st } = await supabaseAdmin.from('league_standings').select('*').eq('team_id', teamId).single();

// СТАЛО (matchId нужен для получения league_instance_id):
const { data: st } = await supabaseAdmin
  .from('league_standings')
  .select('*')
  .eq('team_id', teamId)
  .eq('league_instance_id', match.league_instance_id)
  .maybeSingle();
```

---

## 6. Итоговая матрица приоритетов

```
🔴 P0 (Делать немедленно):
  [R1] Fire-and-forget для cron-цепочки → process-matches/route.ts
  [R2] Idempotency Guard через status='finishing' → end-of-season/route.ts  
  [R3] Восстановить return в auth guard → league-autofill/route.ts
  [R4] Удалить dummy match exploit → matchActions.ts

🟡 P1 (До следующего деплоя):
  [R5] safe_deduct_treasury SQL функция + season_reward_paid flag
  [R6] Атомарная update_fancoins_after_match SQL функция

🟢 P2 (Технический долг):
  [R7] Уведомление при 0 здоровых игроков в составе
  [L1] Фильтр по league_instance_id в simulateNextRound standings query
  [L2] Проверка на дублирование матчей в generateLeagueSchedule
  [L3] Фильтр league_instance_id в updateStandings
```
