# 🔒 Отчёт по аудиту безопасности — FitManager Game

> Дата: 2026-06-02 | Охват: `app/actions/`, `app/api/`, `lib/`, `services/`

---

## 🔴 КРИТИЧЕСКИЕ УЯЗВИМОСТИ (7 шт.)

---

### C1 — Открытый API эндпоинт без аутентификации (SP-инъекция)
**Файл:** [`app/api/fitness/sync/route.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/api/fitness/sync/route.ts) — строки 4–47

**Суть:** POST-эндпоинт принимает `userId` прямо из тела запроса и **не проверяет никакую сессию или куки**. Любой человек из интернета может отправить:

```http
POST /api/fitness/sync
{ "userId": "<чужой uuid>", "steps": 999999, "timezoneDate": "2026-06-02" }
```

И зачислить шаги / Sweat Points **любому пользователю** в обход всей игровой экономики. RPC `sync_daily_steps` имеет кап в 25k шагов, но атаку можно повторять каждый день.

**Риск:** Полная компрометация экономики Sweat Points. Может использоваться для фарма или саботажа.

> [!CAUTION]
> Это единственный эндпоинт, где вообще нет никакой аутентификации. Исправить в первую очередь.

---

### C2 — `debugAddTonAction` — Debug-функция начисления TON в продакшене
**Файл:** [`app/actions/marketActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/marketActions.ts) — строки 143–169

**Суть:** Функция позволяет **любому авторизованному пользователю** добавить себе произвольное количество TON:

```typescript
export async function debugAddTonAction(amount: number) {
  // Только проверка куки — нет ни RBAC, ни лимита суммы, ни флага окружения
  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ balance_ton: (user.balance_ton || 0) + amount })
    .eq('id', userId);
```

Нет проверки `process.env.NODE_ENV !== 'production'`, нет RBAC, нет ограничения суммы. Если фронтенд где-то вызывает эту функцию — это прямая дыра в реальные деньги.

> [!CAUTION]
> Функция должна быть либо удалена из продакшена, либо обёрнута в жёсткую RBAC-проверку + env guard.

---

### C3 — `addSweatPoints` — Отсутствует проверка роли администратора
**Файл:** [`app/actions/adminActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/adminActions.ts) — строки 194–213

**Суть:** Функция `addSweatPoints(amount: number)` проверяет только наличие куки `tg_user_id`, но **не проверяет, является ли вызывающий администратором**. Для сравнения: соседняя функция `seedBotLeague` делает RBAC-проверку по `ADMIN_TG_IDS`. `addSweatPoints` — нет.

```typescript
export async function addSweatPoints(amount: number) {
  const sessionUuid = cookieStore.get('tg_user_id')?.value;
  if (!sessionUuid) return { success: false, error: 'Unauthorized' };
  // ⚠️ Нет проверки: adminIdsArray.includes(currentUserIdStr)
  await supabaseAdmin.from('users').update({ sweat_points: ... }).eq('id', sessionUuid);
}
```

**Риск:** Любой игрок, знающий имя функции (Server Action), может добавить себе SP.

---

### C4 — `hardResetUserTeam` — Нет аутентификации вообще
**Файл:** [`app/actions/adminActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/adminActions.ts) — строки 215–247

**Суть:** Функция принимает `userId: string` как параметр и **не читает ни одну куку**. Нет проверки, кто делает вызов. Любой, кто может вызвать Server Action, может передать любой `userId` и удалить команду этого пользователя вместе со всеми игроками (через каскадное удаление).

```typescript
export async function hardResetUserTeam(userId: string) {
  // ⚠️ Нет: const userId = cookieStore.get('tg_user_id')?.value;
  // ⚠️ Нет: RBAC проверки
  await supabaseAdmin.from('teams').delete().eq('id', team.id); // удаление!
}
```

**Риск:** Полное удаление данных произвольного игрока. IDOR + отсутствие авторизации.

---

### C5 — `baseActions.ts` — Массовый IDOR через `userId`-параметры
**Файл:** [`app/actions/baseActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/baseActions.ts)

**Суть:** ВСЕ публичные функции в файле принимают `userId: string` как параметр, а не берут из куки. Это Insecure Direct Object Reference (IDOR) — клиент может передать чужой `userId`.

| Функция | Последствие атаки |
|---|---|
| `healPlayer(userId, playerId)` | Тратить SP чужого пользователя или лечить чужих игроков |
| `healAllPlayers(userId)` | Слить весь SP чужого пользователя |
| `upgradeStadium(userId)` | Тратить FC чужого пользователя |
| `upgradeMedicalCenter(userId)` | Тратить FC чужого пользователя |
| `upgradeTrainingCenter(userId)` | Тратить FC чужого пользователя |
| `forceInjuryDebug(userId)` | ⚠️ Травмировать игрока чужой команды |
| `getStadiumData(userId)` | Просмотр данных чужого игрока |
| `getInjuredPlayers(userId)` | Утечка данных |

> [!CAUTION]
> `forceInjuryDebug` особенно опасна — это debug-функция, которая травмирует игроков. Она должна быть удалена из продакшена.

---

### C6 — `league-autofill` — Дублирование расписания для заполненной лиги
**Файл:** [`app/api/cron/league-autofill/route.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/api/cron/league-autofill/route.ts) — строки 178–183

**Суть:** Ветка `else if (currentCount >= targetCount)` (инстанс уже полон, но status == 'filling') вызывает `generateLeagueSchedule(instance.id)` **без проверки на уже существующие матчи**. В отличие от основного пути (строки 166–175), который проверяет `existingMatches`.

```typescript
} else if (currentCount >= targetCount) {
  // Just in case it's full but status didn't update
  await supabaseAdmin.from('league_instances').update({ status: 'active', ... }).eq('id', instance.id);
  await generateLeagueSchedule(instance.id); // ⚠️ Нет проверки дубликатов!
}
```

**Риск:** При повторном вызове cron для уже активной (полной) лиги — дублирование 182 матчей (26 раундов × 7 матчей × 2). Воспроизводимый сценарий: кратковременное дублирование из-за сбоя cron.

---

### C7 — `league-sim/route.ts` — Legacy cron без изоляции по league_instance_id
**Файл:** [`app/api/cron/league-sim/route.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/api/cron/league-sim/route.ts)

**Суть:** Этот файл — устаревший движок симуляции, который всё ещё существует и вызывается через GET-запрос. Критические проблемы:

1. **INSERT матчей без `league_instance_id`** (строка 86–96): созданные матчи — "сироты", не привязанные ни к одной лиге.
2. **UPDATE standings без `league_instance_id`** (строка 139–147): может обновить строки standings из разных сезонов одной команды.
3. **Простое последовательное сопряжение команд** (строки 27–32): игнорирует расписание и лиги, пары случайные.

> [!WARNING]
> Если этот эндпоинт активен в vercel.json или вызывается фронтендом — он создаёт мусорные данные в БД параллельно с основным движком.

---

## 🟡 СРЕДНИЕ УЯЗВИМОСТИ (8 шт.)

---

### M1 — `simulateNextPendingMatch` — IDOR через userId-параметр
**Файл:** [`app/actions/matchActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/matchActions.ts) — строки 558–632

Функция принимает `userId: string` без cookie-верификации. Можно принудительно симулировать матч чужой команды — изменить standings, FC-баланс, стамину игроков противника.

---

### M2 — `batchTrainPlayerAction` — Race Condition при списании монет
**Файл:** [`app/actions/trainingActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/trainingActions.ts) — строки 255–331

Классический паттерн Read-Check-Write без атомарности:
```typescript
// 1. Читаем балансы
const { data: user } = await supabaseAdmin.from('users').select('...');
// 2. Проверяем
if (user.cardio_coin < totalCosts.cardio_coin) return error;
// 3. Два параллельных запроса оба пройдут проверку, оба спишут монеты!
await supabaseAdmin.from('users').update(newBalances).eq('id', userId);
```
При двух параллельных запросах на прокачку: оба пройдут проверку баланса и оба спишут монеты, итоговый баланс окажется отрицательным или неверным.

---

### M3 — `renamePlayerAction` — Race Condition при списании FC
**Файл:** [`app/actions/teamActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/teamActions.ts) — строки 298–317

Аналогичный паттерн R-C-W без RPC-блокировки. Два параллельных запроса на переименование разных игроков могут оба пройти баланс-чек и оба списать 1000 FC при фактическом балансе < 2000.

---

### M4 — `markMatchAsViewed` — Нет проверки владельца матча
**Файл:** [`app/actions/matchActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/matchActions.ts) — строки 26–41

```typescript
export async function markMatchAsViewed(matchId: string) {
  // ⚠️ Нет: проверки, что matchId принадлежит вызывающему пользователю
  await supabaseAdmin.from('league_matches').update({ is_viewed: true }).eq('id', matchId);
}
```
Любой авторизованный пользователь может пометить любой матч как просмотренный (minor gameplay integrity issue).

---

### M5 — `stamina-regen` — Обход аутентификации на localhost
**Файл:** [`app/api/cron/stamina-regen/route.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/api/cron/stamina-regen/route.ts) — строки 14–19

```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  if (!request.url.includes('localhost')) { // ⚠️ Localhost bypass!
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```
В staging/dev окружениях (ngrok, tunnel), где URL содержит 'localhost' в referrer или origin — проверка пропускается. Более надёжный подход: `process.env.NODE_ENV === 'development'`.

---

### M6 — JWT-секрет для Free Agents = CRON_SECRET с hardcoded fallback
**Файл:** [`app/actions/marketActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/marketActions.ts) — строки 184, 254

```typescript
const jwtSecret = process.env.CRON_SECRET || 'fallback_secret_for_jwt';
```
**Два риска:**
1. `CRON_SECRET` — не предназначен для подписи JWT. При ротации ключа все активные контракты сгорят.
2. Если `CRON_SECRET` не задан (dev/staging), используется предсказуемый fallback. Злоумышленник может вручную создать JWT с любым `priceFc: 1` и купить игрока за 1 монету.

---

### M7 — `getMatchHistory/getMatchSchedule` — Утечка данных через userId-параметр
**Файл:** [`app/actions/matchActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/matchActions.ts) — строки 43, 110

Функции принимают `userId` без cookie-верификации. Можно просматривать историю матчей и расписание любого игрока. Нарушение конфиденциальности, хотя данные не являются финансовыми.

---

### M8 — `simulateNextRound` — Нет idempotency guard (Race Condition в standings)
**Файл:** [`app/actions/calendarActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/calendarActions.ts) — строки 73–419

В отличие от `process-matches` cron (который имеет CAS-guard через статус матча `is_played`), эта функция читает standings в начале, накапливает дельты, а в конце пишет **абсолютные значения**. При двух параллельных вызовах: оба читают одинаковые начальные standings → оба записывают одинаковые финальные значения → одна симуляция раунда "теряется".

---

## 🟢 МЕЛКИЕ НЕДОЧЁТЫ (4 шт.)

---

### N1 — `executeBotSeeding` — standings без `league_instance_id`
**Файл:** [`app/actions/adminActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/adminActions.ts) — строки 131–150

Ботовые standings вставляются без `league_instance_id`. Эти "сиротские" строки могут быть найдены запросами, которые фильтруют только по `team_id`.

---

### N2 — Дублирование `supabaseAdmin`-клиента во всех файлах
Каждый `actions/*.ts` файл делает свой собственный `createClient(url, serviceKey)` вместо импорта общего `supabaseAdmin` из `lib/supabase-admin.ts`. Это затрудняет ротацию ключей и создаёт лишние connection pool записи.

---

### N3 — Fallback при ошибке RPC использует устаревший баланс
**Файл:** [`app/actions/teamActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/teamActions.ts) — строки 353–356, 393–396

```typescript
if (deductError) {
  // ⚠️ user.balance_fancoins — прочитан ДО вызова RPC, значение устарело
  await supabaseAdmin.from('users').update({ balance_fancoins: user.balance_fancoins - 1000 }).eq('id', userId);
}
```
Если RPC частично выполнился и упал, fallback применит вычитание ещё раз к устаревшему значению.

---

### N4 — `scoutYouthPlayer` — нет cooldown и стоимости
**Файл:** [`app/actions/scoutingActions.ts`](file:///H:/Work/AntigravityProject/fitmanager_game/app/actions/scoutingActions.ts) — строки 165–227

Функция вставляет нового игрока без какой-либо стоимости (SP/FC) и без cooldown. Если это не намеренная механика — пользователь может бесконечно расширять состав бесплатно.

---

## 📋 Сводная таблица приоритетов

| # | Уязвимость | Файл | Серьёзность | Сложность фикса |
|---|---|---|---|---|
| C1 | Открытый `/api/fitness/sync` | `fitness/sync/route.ts` | 🔴 Критич. | Низкая |
| C2 | `debugAddTonAction` в проде | `marketActions.ts` | 🔴 Критич. | Низкая |
| C3 | `addSweatPoints` без RBAC | `adminActions.ts` | 🔴 Критич. | Низкая |
| C4 | `hardResetUserTeam` без auth | `adminActions.ts` | 🔴 Критич. | Низкая |
| C5 | IDOR в `baseActions.ts` | `baseActions.ts` | 🔴 Критич. | Средняя |
| C6 | Дублирование расписания autofill | `league-autofill/route.ts` | 🔴 Критич. | Низкая |
| C7 | Legacy `league-sim` cron | `league-sim/route.ts` | 🔴 Критич. | Низкая |
| M1 | IDOR `simulateNextPendingMatch` | `matchActions.ts` | 🟡 Средняя | Низкая |
| M2 | Race Condition `batchTrain` | `trainingActions.ts` | 🟡 Средняя | Высокая |
| M3 | Race Condition `renamePlayer` | `teamActions.ts` | 🟡 Средняя | Низкая |
| M4 | `markMatchAsViewed` без owner check | `matchActions.ts` | 🟡 Средняя | Низкая |
| M5 | localhost bypass в stamina-regen | `stamina-regen/route.ts` | 🟡 Средняя | Низкая |
| M6 | JWT fallback секрет | `marketActions.ts` | 🟡 Средняя | Низкая |
| M7 | Утечка данных матчей | `matchActions.ts` | 🟡 Средняя | Низкая |
| M8 | Race Condition `simulateNextRound` | `calendarActions.ts` | 🟡 Средняя | Средняя |
| N1 | standings без instance_id | `adminActions.ts` | 🟢 Мелкий | Низкая |
| N2 | Дублирование supabaseAdmin | Все actions | 🟢 Мелкий | Средняя |
| N3 | Stale fallback баланс | `teamActions.ts` | 🟢 Мелкий | Низкая |
| N4 | Безлимитный скаутинг | `scoutingActions.ts` | 🟢 Мелкий | Низкая |

---

## ✅ Что сделано хорошо

- ✅ **Telegram initData** верифицируется криптографически (`lib/telegramAuth.ts`) с проверкой auth_date
- ✅ **`tg_user_id` cookie** — httpOnly, secure в production, sameSite: 'lax'
- ✅ **`resolveMatch`** — использует атомарный RPC `update_fancoins_after_match` (R6 fix)
- ✅ **end-of-season cron** — имеет CAS-guard (`active` → `finishing`) и `season_reward_paid` флаг
- ✅ **`economyActions.ts`** — корректно использует RPC с FOR UPDATE блокировкой
- ✅ **`generateLeagueSchedule`** — защищена от дубликатов в основном пути
- ✅ **CRON_SECRET проверяется** во всех новых cron-роутах (кроме stamina-regen)
- ✅ **`lineupActions.ts`** — проверяет владение игроками через team_id
- ✅ **`marketActions.ts`** — рыночные операции делегированы DB RPC (`buy_player_from_market`, etc.)
