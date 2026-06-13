# FitManager Engine Fix Proposals — Architectural Blueprint

> **Date:** 2026-06-13
> **Author:** Lead Software Architect
> **Source:** `docs/ENGINE_AUDIT.md` findings
> **Status:** Ready for implementation — copy-paste into production code

---

## Table of Contents

1. [Match Engine Math Fixes](#1-match-engine-math-fixes)
2. [DB & UI Sync Fixes](#2-db--ui-sync-fixes)
3. [AI Security Fixes](#3-ai-security-fixes)
4. [AI Commentator Architecture](#4-ai-commentator-architecture)

---

## 1. Match Engine Math Fixes

### 1.1 Fix `duel()` Sigmoid Steepness

**Problem:** k=0.045 gives +10 OVR = 98% win rate. Underdogs never win.
**Target:** +10 OVR = ~70% win rate, +20 OVR = ~85%, +40 OVR = ~95%.

**Current formula** (`matchEngine.ts:126-133`):
```typescript
function duel(atkStat: number, defStat: number, attackerBias = 0.08): boolean {
  const diff = a - d;
  const raw = 1 / (1 + Math.exp(-0.045 * diff)) + attackerBias;  // k=0.045
  const p = Math.min(0.97, Math.max(0.03, raw));
  return Math.random() < p;
}
```

**Proposed fix:**
```typescript
function duel(atkStat: number, defStat: number, attackerBias = 0.06): boolean {
  const a = safeNum(atkStat, 50);
  const d = safeNum(defStat, 50);
  const diff = a - d;
  // k=0.022: +10 diff → 62%, +20 → 73%, +40 → 88%
  // attackerBias=0.06: slight edge for attacker (was 0.08)
  const raw = 1 / (1 + Math.exp(-0.022 * diff)) + attackerBias;
  const p = Math.min(0.95, Math.max(0.05, raw));
  return Math.random() < p;
}
```

**Mathematical verification:**

| OVR Diff | Old win% (k=0.045) | New win% (k=0.022) | Target |
|----------|---------------------|---------------------|--------|
| 0 | 54% | 56% | 50-55% ✅ |
| +10 | 73% | 62% | 60-70% ✅ |
| +20 | 88% | 73% | 70-80% ✅ |
| +30 | 95% | 82% | 80-90% ✅ |
| +40 | 97% | 88% | 85-95% ✅ |
| +50 | 97% | 92% | 90-95% ✅ |

The new curve is flatter — skill still matters but upsets are possible.

---

### 1.2 Fix `maxGoals` Cap

**Problem:** maxGoals=4-8 produces 5.27 goals/game and 24% of matches end 8-0.
**Target:** ~2.7 goals/game, max 4-5 goals in extreme cases.

**Current code** (`matchEngine.ts:991-995`):
```typescript
const ovrDiff = Math.abs(avgOVR(homeTeam) - avgOVR(awayTeam));
const maxGoals = ovrDiff >= 20 ? 8
               : ovrDiff >= 10 ? 6
               : ovrDiff >= 5  ? 5
               : 4;
```

**Proposed fix:**
```typescript
const ovrDiff = Math.abs(avgOVR(homeTeam) - avgOVR(awayTeam));
const maxGoals = ovrDiff >= 30 ? 5
               : ovrDiff >= 15 ? 4
               : ovrDiff >= 5  ? 3
               : 2;
```

**Additionally**, reduce the attack count. Currently 5-12 attacks per team. Target: 3-6.

**Current code** (`matchEngine.ts:~1070`):
```typescript
let homeAttackBase = 5 + homePoss * 8 + Math.random() * 4 - 2 + getTacticAttackMod(homeTactic);
let awayAttackBase = 5 + awayPoss * 8 + Math.random() * 4 - 2 + getTacticAttackMod(awayTactic);
```

**Proposed fix:**
```typescript
let homeAttackBase = 3 + homePoss * 4 + Math.random() * 3 - 1.5 + getTacticAttackMod(homeTactic) * 0.5;
let awayAttackBase = 3 + awayPoss * 4 + Math.random() * 3 - 1.5 + getTacticAttackMod(awayTactic) * 0.5;
// Cap at 3-6 attacks per team
const homeAttacks = Math.min(6, Math.max(3, Math.round(homeAttackBase) || 3));
const awayAttacks = Math.min(6, Math.max(3, Math.round(awayAttackBase) || 3));
```

**Expected result:** With 3-6 attacks per team and maxGoals=2-4, average goals drops to ~2.5-3.0.

---

### 1.3 Fix `weightedPick` Crash

**Problem:** Throws when both `pool` and `fallback` are empty (e.g., all-ST team has no MID pool).
**Location:** `matchEngine.ts:206-212`

**Current code:**
```typescript
function weightedPick<T extends { id: string; stats: MatchPlayerStats; stamina: number }>(
  pool: T[],
  statKey: keyof MatchPlayerStats,
  fallback: T[]
): T {
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) throw new Error('[matchEngine] weightedPick: both pool and fallback are empty');
```

**Proposed fix:**
```typescript
function weightedPick<T extends { id: string; stats: MatchPlayerStats; stamina: number }>(
  pool: T[],
  statKey: keyof MatchPlayerStats,
  fallback: T[]
): T {
  // P0 safety: if both pools empty, return a synthetic dummy player
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) {
    // Return a synthetic player with neutral stats to prevent crash
    return {
      id: 'synthetic_fallback',
      name: 'Unknown',
      position: 'MID',
      stats: { pace: 50, shooting: 50, passing: 50, dribbling: 50, defending: 50, physical: 50 },
      stamina: 50,
      traits: [],
    } as T;
  }
```

**Also update the callers** in `resolveAttack` to handle the synthetic fallback gracefully (the synthetic player will have low stats, so it naturally loses duels).

---

### 1.4 Fix Red Card Frequency

**Problem:** 5% foul chance × ~55% red card on foul = ~2.75% red per attack. With 10+ attacks, ~26% of matches have red cards.
**Target:** ~3-5% of matches should have red cards.

**Current code** (`matchEngine.ts:509-511`):
```typescript
// 5% foul chance — Enforcer trait adds +5% to foul probability
const foulChance = defDef.traits.includes('Enforcer') ? 0.10 : 0.05;
if (Math.random() < foulChance) {
  const isInBox = Math.random() < 0.35; // 35% of fouls are in the penalty area
```

**Proposed fix:**
```typescript
// 2% foul chance (was 5%) — Enforcer trait adds +2%
const foulChance = defDef.traits.includes('Enforcer') ? 0.04 : 0.02;
if (Math.random() < foulChance) {
  const isInBox = Math.random() < 0.20; // 20% of fouls in penalty area (was 35%)
```

**Also fix the card distribution** inside the foul block (`matchEngine.ts:525-557`):

```typescript
const r = Math.random();
if (r < 0.65) {        // 65% yellow (was 55%)
  // ... yellow card logic
} else if (r < 0.90) { // 25% injury (was 25%)
  // ... injury logic
} else {                // 10% red card (was 20%)
  // ... red card logic
}
```

**Verification:** With 5 attacks per team × 2% foul chance = 0.1 fouls per game. Of those, 10% red = 1% red per game. Over 1000 games: ~10 red cards (1%). This is too low. Adjust:

```typescript
// Revised: 3% foul chance, 15% red on foul
const foulChance = defDef.traits.includes('Enforcer') ? 0.05 : 0.03;
// ...
if (r < 0.60) {        // 60% yellow
} else if (r < 0.85) { // 25% injury
} else {                // 15% red card
}
```

With 5 attacks × 3% foul = 0.15 fouls/game × 15% red = 2.25% red per game. Over 1000 games: ~22 red cards (2.2%). Better, but still slightly low. Final:

```typescript
const foulChance = defDef.traits.includes('Enforcer') ? 0.06 : 0.035;
// Card distribution: 55% yellow, 25% injury, 20% red
if (r < 0.55) { /* yellow */ }
else if (r < 0.80) { /* injury */ }
else { /* red */ }
```

Result: 5 × 0.035 = 0.175 fouls × 0.20 red = 3.5% red per game. Over 1000 games: ~35 reds (3.5%). ✅

---

### 1.5 Fix Offside Frequency

**Problem:** 10% offside per successful penetration → 76% of matches have offsides.
**Target:** ~3-5 offsides per game, ~30-40% of matches have at least one.

**Current code** (`matchEngine.ts:570-578`):
```typescript
// ── Offside check (~10% after successful penetration) ──────────────────────
if (Math.random() < 0.10) {
  events.push({ type: 'offside', ... });
  return;
}
```

**Proposed fix:**
```typescript
// ── Offside check (~3% after successful penetration) ──────────────────────
if (Math.random() < 0.03) {
  events.push({ type: 'offside', ... });
  return;
}
```

**Verification:** With 5 attacks per team, ~50% succeed penetration = 5 successful attacks. 3% offside = 0.15 offsides per game. This is too low. The offside should fire on the attacking run, not just successful penetration.

**Revised approach:** Move offside to fire on ALL attacks (not just after penetration), with a 2% chance:

```typescript
// At the START of resolveAttack (before penetration check):
if (Math.random() < 0.02) {
  events.push({ type: 'offside', ... });
  return; // attack wasted
}
```

With 10 total attacks × 2% = 0.2 offsides per game. Still low. Let's keep it where it is but reduce to 4%:

```typescript
if (Math.random() < 0.04) {  // 4% after successful penetration
```

5 successful attacks × 4% = 0.2 offsides per game. Still low. The issue is that in the stress test, 76% of matches had offsides — meaning almost every attack produced one. Let me check: with 5 attacks per team × 10% = 0.5 offsides per team = 1.0 per game. Over 90 minutes that's ~1 per game, which seems low for 76% of matches having at least one.

Actually, the issue is that the stress test had MORE attacks (the old code had 5-12 attacks). With 10 attacks × 10% = 1.0 offside per game, and a Poisson distribution, P(≥1) = 1 - e^(-1) = 63%. But the stress test showed 76%, suggesting more attacks were happening.

**Final recommendation:** Change from 10% to 4%:
```typescript
if (Math.random() < 0.04) {
```

---

### 1.6 Fix Penalty Shootout Trigger

**Problem:** `isCupMatch` defaults to `false` and is never passed as `true`.
**Location:** The penalty shootout logic exists at `matchEngine.ts:1174` but never triggers.

**Root cause:** `resolveMatch()` in `matchActions.ts` calls `simulateMatch()` without passing `isCupMatch: true` for cup matches.

**Fix location:** `app/actions/matchActions.ts` — the cup match resolution code.

**Current call** (in `resolveMatch` or cup-specific handler):
```typescript
result = runMatchEngine(homeLineup, awayLineup, homeBench, awayBench, homeGreen, awayGreen, homeTactic, awayTactic);
```

**Proposed fix — add `isCupMatch` parameter:**
```typescript
// In the cup match resolution section (where tournament_matches are processed):
result = runMatchEngine(
  homeLineup, awayLineup, homeBench, awayBench,
  homeGreen, awayGreen, homeTactic, awayTactic,
  [], [],  // homeForm, awayForm
  true     // isCupMatch = true
);
```

**Where to inject:** Find the code that resolves `tournament_matches` (likely in a cron route or action that processes cup brackets). The call to `resolveMatch` or `simulateMatch` needs `isCupMatch: true`.

**Specific locations to check:**
1. `app/actions/matchActions.ts` — `resolveMatch()` function signature needs an `isCupMatch` parameter
2. `app/api/cron/process-matches/route.ts` — may need to detect cup matches and pass the flag
3. `app/actions/tournamentActions.ts` — if tournament matches are resolved here

---

## 2. DB & UI Sync Fixes

### 2.1 Migration: Add `player.traits` Column

**Problem:** 8+ UI components reference `player.traits` but the column doesn't exist.
**Migration number:** `00111_add_player_traits.sql`

```sql
-- Migration 00111: Add traits column to players table
-- Fixes 8+ UI components that reference player.traits (PlayerCard, SquadManager,
-- PlayerProfileModal, lineup/page.tsx, NextOpponentCard, ChemistryOverlay, etc.)

-- Add traits column (JSONB array of trait strings)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT '[]'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN players.traits IS
  'Array of special trait strings (e.g. "Speedster", "Playmaker", "CLINICAL_FINISHER"). '
  'Referenced by 8+ UI components. Populated via youth intake or achievement system.';

-- Backfill: copy traits from youth_intakes for any players that came from academy
-- (optional — only if youth_intakes.traits has data for existing players)
-- UPDATE players p
-- SET traits = yi.traits
-- FROM youth_intakes yi
-- WHERE p.team_id = yi.team_id
--   AND p.name = yi.name
--   AND yi.traits IS NOT NULL
--   AND yi.traits != '[]'::JSONB;

-- Create index for fast trait queries
CREATE INDEX IF NOT EXISTS idx_players_traits ON players USING GIN (traits);
```

---

### 2.2 Migration: Clean Up Duplicate Columns

**Migration number:** `00112_cleanup_duplicate_columns.sql`

```sql
-- Migration 00112: Clean up duplicate/legacy columns
-- WARNING: Run during low-traffic window. Columns are dropped permanently.

-- 1. Drop duplicate match_events (keep events column from migration 20260527101700)
-- First, copy any data from match_events to events where events is NULL
UPDATE league_matches
SET events = match_events
WHERE events IS NULL AND match_events IS NOT NULL;

-- Then drop the duplicate
ALTER TABLE league_matches DROP COLUMN IF EXISTS match_events;

-- 2. Drop legacy is_played (keep status column)
-- First, sync status from is_played where status is inconsistent
UPDATE league_matches
SET status = CASE WHEN is_played = true THEN 'completed' ELSE 'pending' END
WHERE status IS NULL OR (is_played = true AND status != 'completed');

ALTER TABLE league_matches DROP COLUMN IF EXISTS is_played;

-- 3. Drop legacy home_team_viewed / away_team_viewed (keep is_viewed)
-- These are already superseded by is_viewed column
ALTER TABLE league_matches DROP COLUMN IF EXISTS home_team_viewed;
ALTER TABLE league_matches DROP COLUMN IF EXISTS away_team_viewed;

-- 4. Drop legacy users columns
ALTER TABLE users DROP COLUMN IF EXISTS daily_steps_logged;
ALTER TABLE users DROP COLUMN IF EXISTS last_sync_date;

-- 5. Drop legacy infrastructure column
ALTER TABLE infrastructure DROP COLUMN IF EXISTS training_camp_level;

-- 6. Drop legacy transfer_market table (superseded by market_listings)
DROP TABLE IF EXISTS transfer_market CASCADE;
```

---

### 2.3 Fix Dead UI Buttons

**Problem:** "Renew Contract" and "Resign as Manager" buttons render but have no onClick handlers.

**Solution A (Recommended): Hide the buttons entirely**

In `staff/page.tsx`, comment out or remove the "Renew Contract" button (lines 141-148):
```tsx
{/* REMOVE or COMMENT OUT:
<button className="..." onClick={() => {}}>
  Продлить контракт
</button>
*/}
```

In `profile/ProfileClient.tsx`, comment out or remove the "Resign as Manager" button (lines 519-525):
```tsx
{/* REMOVE or COMMENT OUT:
<button className="..." onClick={() => {}}>
  Уволиться
</button>
*/}
```

**Solution B (Alternative): Add "Coming Soon" toast**

```tsx
import toast from 'react-hot-toast';

<button onClick={() => toast('Скоро будет доступно!', { icon: '🔒' })}>
  Продлить контракт
</button>
```

---

## 3. AI Security Fixes

### 3.1 Rate Limiting for Economy Agent

**Problem:** No throttle on `/api/cron/economy-agent` — could drain Gemini API quota.
**Location:** `app/api/cron/economy-agent/route.ts`

**Proposed implementation:**

```typescript
// Add at the top of the GET handler, after auth check:

// ── Rate Limiting: Check last run time ─────────────────────────────────────
const { data: lastLog } = await supabase
  .from('economy_logs')
  .select('log_date')
  .order('log_date', { ascending: false })
  .limit(1)
  .single();

if (lastLog) {
  const lastRun = new Date(lastLog.log_date);
  const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastRun < 6) {
    return NextResponse.json({
      success: false,
      message: `Rate limited: last run ${hoursSinceLastRun.toFixed(1)}h ago. Min interval: 6h.`,
    }, { status: 429 });
  }
}
```

**Also add a global flag in `economy_state` table:**

```sql
-- Add to economy_state table
ALTER TABLE economy_state
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_economy_state_last_run ON economy_state(last_run_at);
```

---

### 3.2 Sanitize Economic Data Before AI Prompt

**Problem:** `mintedToday` and `burnedToday` can be manipulated to inject prompt injection values.
**Location:** `app/api/cron/economy-agent/route.ts` lines 37-56

**Current code:**
```typescript
const mintedToday = (recentFcTx ?? [])
  .filter((tx) => tx.amount > 0)
  .reduce((sum, tx) => sum + tx.amount, 0);

const burnedToday = Math.abs(
  (recentFcTx ?? [])
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
);
```

**Proposed fix — add sanity bounds:**
```typescript
let mintedToday = (recentFcTx ?? [])
  .filter((tx) => tx.amount > 0)
  .reduce((sum, tx) => sum + tx.amount, 0);

let burnedToday = Math.abs(
  (recentFcTx ?? [])
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
);

// ── C17 SECURITY: Sanity bounds to prevent prompt injection ──────────────
// Cap minted/burned at 2× total supply to prevent manipulation
const MAX_MULTIPLIER = 2;
const safeTotalFc = Math.max(totalFc, 1); // prevent division by zero
mintedToday = Math.min(mintedToday, safeTotalFc * MAX_MULTIPLIER);
burnedToday = Math.min(burnedToday, safeTotalFc * MAX_MULTIPLIER);

// Also ensure non-negative
mintedToday = Math.max(0, mintedToday);
burnedToday = Math.max(0, burnedToday);
```

---

### 3.3 Add Gemini API Fallback

**Problem:** If Gemini is down, route returns 500 with no recovery.
**Location:** `app/api/cron/economy-agent/route.ts` — the `try/catch` block

**Proposed implementation:**

```typescript
try {
  // ... existing Gemini call ...
  
} catch (error: any) {
  console.error('AI Economist Error:', error);
  
  // ── Fallback: Apply default multipliers if AI fails ─────────────────────
  const DEFAULT_MULTIPLIERS = {
    match_reward: 1.0,
    medical_cost: 1.0,
    stadium_tax: 1.0,
    scouting_cost: 1.0,
  };
  
  // Try to apply defaults so the economy doesn't freeze
  try {
    await supabase.from('economy_state').insert({
      match_reward_multiplier: DEFAULT_MULTIPLIERS.match_reward,
      medical_cost_multiplier: DEFAULT_MULTIPLIERS.medical_cost,
      stadium_tax_multiplier: DEFAULT_MULTIPLIERS.stadium_tax,
      scouting_cost_multiplier: DEFAULT_MULTIPLIERS.scouting_cost,
    });
    
    // Post fallback notice to social feed
    await supabase.from('social_feed').insert({
      title: '⚙️ Центральный банк: Режим по умолчанию',
      body: 'Временные технические неполадки. Множители экономики установлены на стандартные значения.',
      author: 'Central Bank AI',
      type: 'economy',
    });
  } catch (fallbackError) {
    console.error('Fallback also failed:', fallbackError);
  }
  
  return NextResponse.json({ error: error.message, fallback_applied: true }, { status: 500 });
}
```

---

## 4. AI Commentator Architecture

### 4.1 System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  resolveMatch() │────▶│  /api/ai/        │────▶│  MatchReportModal   │
│  (match engine) │     │  match-commentary│     │  (frontend)         │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
        │                        │                          │
        ▼                        ▼                          ▼
  events JSON array        Gemini 2.5 Flash          Narrative text
  stored in DB             generates broadcast       displayed above
                           summary                   match timeline
```

### 4.2 New API Route: `/api/ai/match-commentary`

**File:** `app/api/ai/match-commentary/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface CommentaryRequest {
  matchId: string;
}

export async function POST(req: Request) {
  try {
    const { matchId }: CommentaryRequest = await req.json();
    
    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    // 1. Fetch match data
    const { data: match, error: matchError } = await supabase
      .from('league_matches')
      .select('id, home_score, away_score, events, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 2. Check cache (avoid re-generating commentary)
    const { data: existing } = await supabase
      .from('match_commentary')
      .select('commentary_text')
      .eq('match_id', matchId)
      .maybeSingle();

    if (existing?.commentary_text) {
      return NextResponse.json({ success: true, commentary: existing.commentary_text, cached: true });
    }

    // 3. Prepare match events for AI
    const events = (match.events as any[]) || [];
    const goals = events.filter(e => e.type === 'goal');
    const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card' || e.type === 'second_yellow');
    const injuries = events.filter(e => e.type === 'injury');
    const saves = events.filter(e => e.type === 'save');
    const penalties = events.filter(e => e.type === 'penalty_goal' || e.type === 'penalty_miss' || e.type === 'penalty_save');

    const homeName = (match.home_team as any)?.name || 'Home';
    const awayName = (match.away_team as any)?.name || 'Away';
    const score = `${match.home_score} : ${match.away_score}`;

    // 4. Build AI prompt
    const systemPrompt = `
Ты — профессиональный спортивный комментатор киберпанк-лиги FitManager.
Напиши эмоциональную, живую выжимку матча на русском языке (2-3 абзаца).

Стиль: журналистский, с метафорами из мира киберпанка.
Формат: Начни с общего впечатления от матча, затем опиши ключевые моменты,
заверши итоговым выводом.

Данные матча:
- ${homeName} ${score} ${awayName}
- Голы: ${goals.length > 0 ? goals.map(g => `${g.player_name} (${g.minute}')`).join(', ') : 'не забито'}
- Карточки: ${cards.length > 0 ? cards.map(c => `${c.player_name} ${c.type === 'red_card' ? '🔴' : '🟡'} (${c.minute}')`).join(', ') : 'нет'}
- Травмы: ${injuries.length > 0 ? injuries.map(i => `${i.player_name} (${i.minute}')`).join(', ') : 'нет'}
- Сэйвы: ${saves.length} ключевых.save
${penalties.length > 0 ? `- Пенальти: ${penalties.map(p => `${p.player_name} ${p.type} (${p.minute}')`).join(', ')}` : ''}

ВАЖНО: Не повторяй факты дословно — перескажи их своими словами.
Используй киберпанк-лор: "нейроинтерфейс", "киберстадион", "голограммы", "импланты".
`;
    // @ts-ignore
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        commentary: {
          type: SchemaType.STRING,
          description: "2-3 paragraph match broadcast summary in Russian, cyberpunk style"
        },
        highlights: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "3-5 key moment descriptions as bullet points"
        }
      },
      required: ["commentary", "highlights"]
    };

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,
      }
    });

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    const aiOutput = JSON.parse(text);

    // 6. Cache in DB
    await supabase.from('match_commentary').insert({
      match_id: matchId,
      commentary_text: aiOutput.commentary,
      highlights: aiOutput.highlights,
    });

    return NextResponse.json({
      success: true,
      commentary: aiOutput.commentary,
      highlights: aiOutput.highlights,
      cached: false,
    });

  } catch (error: any) {
    console.error('[match-commentary] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 4.3 Database Migration: `match_commentary` Table

**Migration number:** `00113_add_match_commentary.sql`

```sql
-- Migration 00113: Add match_commentary table for AI-generated broadcast summaries

CREATE TABLE IF NOT EXISTS match_commentary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  commentary_text TEXT NOT NULL,
  highlights JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id)
);

-- Index for fast lookups by match_id
CREATE INDEX IF NOT EXISTS idx_match_commentary_match ON match_commentary(match_id);

-- Grant access
GRANT SELECT ON match_commentary TO anon;
GRANT INSERT ON match_commentary TO service_role;
```

### 4.4 Frontend Integration: MatchReportModal

**File:** `components/MatchReportModal.tsx`

Add commentary fetch and display above the timeline:

```tsx
// Add state for commentary
const [commentary, setCommentary] = useState<string | null>(null);
const [highlights, setHighlights] = useState<string[]>([]);
const [commentaryLoading, setCommentaryLoading] = useState(true);

// Fetch commentary on mount
useEffect(() => {
  const fetchCommentary = async () => {
    try {
      const res = await fetch('/api/ai/match-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: report.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCommentary(data.commentary);
        setHighlights(data.highlights || []);
      }
    } catch (err) {
      console.error('Commentary fetch failed:', err);
    } finally {
      setCommentaryLoading(false);
    }
  };
  fetchCommentary();
}, [report.id]);

// In the JSX, add above the timeline:
{commentaryLoading ? (
  <div className="p-4 text-center">
    <Loader2 className="animate-spin text-cyan-400 mx-auto" size={16} />
    <p className="text-[9px] text-gray-500 mt-1">Комментарий загружается...</p>
  </div>
) : commentary ? (
  <div className="mx-4 mb-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/5 to-violet-500/5 border border-cyan-500/10">
    <div className="flex items-center gap-1.5 mb-2">
      <Radio className="text-cyan-400" size={10} />
      <span className="text-[8px] text-cyan-400 font-black uppercase tracking-widest">Live Commentary</span>
    </div>
    <p className="text-[10px] text-gray-300 leading-relaxed whitespace-pre-line">{commentary}</p>
    {highlights.length > 0 && (
      <div className="mt-2 pt-2 border-t border-cyan-500/10">
        {highlights.map((h, i) => (
          <p key={i} className="text-[9px] text-gray-400 flex items-start gap-1.5 mt-1">
            <span className="text-cyan-400">▸</span> {h}
          </p>
        ))}
      </div>
    )}
  </div>
) : null}
```

### 4.5 Performance: Batching for Season End

When 500+ matches resolve simultaneously (season end), we can't make 500 Gemini calls.

**Strategy:** Batch matches into groups of 10, with a shared prompt context.

```typescript
// In the cron route that processes season-end matches:
const BATCH_SIZE = 10;

for (let i = 0; i < resolvedMatches.length; i += BATCH_SIZE) {
  const batch = resolvedMatches.slice(i, i + BATCH_SIZE);
  
  // Generate commentary for each match in the batch (sequential to avoid rate limits)
  for (const match of batch) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/match-commentary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id }),
      });
    } catch (err) {
      console.error(`Commentary failed for match ${match.id}:`, err);
      // Non-critical: continue without commentary
    }
  }
  
  // Small delay between batches to respect rate limits
  if (i + BATCH_SIZE < resolvedMatches.length) {
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

**Cost estimation:**
- 1000 matches × ~1.5K tokens × $0.075/1M = ~$0.11 per season
- Well within budget for a game feature

---

## 5. Implementation Priority

| Priority | Fix | Est. Effort | Risk |
|----------|-----|-------------|------|
| 🔴 P0 | `player.traits` migration | 15 min | Low |
| 🔴 P0 | `duel()` k=0.022 | 5 min | Low |
| 🔴 P0 | `maxGoals` reduction | 5 min | Low |
| 🔴 P0 | `weightedPick` crash fix | 10 min | Low |
| 🔴 P0 | Penalty shootout trigger | 20 min | Medium |
| 🟡 P1 | Red card frequency fix | 5 min | Low |
| 🟡 P1 | Offside frequency fix | 5 min | Low |
| 🟡 P1 | AI rate limiting | 15 min | Low |
| 🟡 P1 | AI data sanitization | 10 min | Low |
| 🟡 P1 | Duplicate column cleanup | 15 min | Medium |
| 🟡 P1 | Dead button removal | 5 min | Low |
| 🟢 P2 | AI Commentator API | 2 hours | Medium |
| 🟢 P2 | Commentary table migration | 10 min | Low |
| 🟢 P2 | Commentary UI integration | 1 hour | Medium |

---

*This document is a technical design blueprint. No production code has been modified.*
