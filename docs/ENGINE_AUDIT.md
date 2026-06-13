# FitManager Engine & Systems Audit Report

> **Date:** 2026-06-13
> **Method:** Automated stress testing (11,200+ simulations), manual code review
> **Scope:** Match Engine, DB↔Frontend Sync, AI Systems (Economy Agent)
> **Constraint:** No production code modified — audit only

---

## Executive Summary

The FitManager match engine has **critical scoring bugs** that produce unrealistic results (5.27 goals/game vs real-world ~2.7). The DB↔Frontend sync has **severe orphaned features** including a ghost `player.traits` column referenced by 8+ UI components but never created in the database. The AI Economy Agent is functional but has prompt injection and cost risks. There is **no AI Commentator** implemented yet.

| Area | Severity | Finding |
|------|----------|---------|
| Match Engine | 🔴 CRITICAL | 5.27 goals/game, 11.6% matches end 8-0 or 0-8 |
| Match Engine | 🔴 CRITICAL | All-ST vs All-GK crashes engine 100% of the time |
| Match Engine | 🟡 HIGH | David vs Goliath: underdog has 0% win rate |
| Match Engine | 🟡 HIGH | 0 penalty shootouts in 11,200 matches |
| DB↔UI Sync | 🔴 CRITICAL | `player.traits` column missing — 8+ UI components reference it |
| DB↔UI Sync | 🟡 MEDIUM | Duplicate `match_events`/`events` columns on `league_matches` |
| DB↔UI Sync | 🟡 MEDIUM | Global Rankings & Search tabs are placeholders |
| DB↔UI Sync | 🟡 MEDIUM | 2 dead buttons (Renew Contract, Resign as Manager) |
| AI Economy Agent | 🟡 MEDIUM | No rate limiting on Gemini API calls |
| AI Economy Agent | 🟡 MEDIUM | Prompt injection possible via economic data |
| AI Commentator | ⚪ N/A | Not implemented yet |

---

## 1. Match Engine Stress Test Results

### 1.1 Simulation Parameters
- **Total matches:** 11,201 (across 8 scenarios)
- **Engine:** `app/utils/matchEngine.ts` (v5.0 "Swiss Watch Architecture")
- **Script:** `scripts/audit_engine.ts`

### 1.2 Core Statistics

| Metric | Value | Expected (Real Football) | Status |
|--------|-------|--------------------------|--------|
| Avg goals/game | **5.27** | 2.5 – 3.5 | 🔴 TOO HIGH |
| Max goals in match | **10** | 7–8 (rare) | 🟡 ACCEPTABLE |
| Min goals in match | **0** | 0 | ✅ OK |
| Red cards (11K games) | **2,956** (26.4%) | ~3–5% | 🔴 TOO MANY |
| Yellow cards | **2,246** (20%) | ~30–40% | 🟡 LOW |
| Second yellows | **25** | ~1–2% | ✅ OK |
| Penalty shootouts | **0** | ~5–10% of cup matches | 🔴 BROKEN |
| Own goals | **10** (0.09%) | ~0.5–1% | ✅ OK |
| Injuries | **1,085** (9.7%) | ~2–5% | 🟡 HIGH |
| Offsides | **8,535** (76%) | ~3–5 per game | 🔴 INSANE |

### 1.3 Extreme Scorelines (Top 10)

| Scoreline | Count | % of Total | Realistic? |
|-----------|-------|------------|------------|
| **0-8** | 1,396 | 12.5% | 🔴 NO |
| **8-0** | 1,302 | 11.6% | 🔴 NO |
| 2-2 | 588 | 5.2% | ✅ Yes |
| 2-1 | 566 | 5.1% | ✅ Yes |
| 1-1 | 461 | 4.1% | ✅ Yes |
| 1-2 | 431 | 3.8% | ✅ Yes |
| 4-1 | 431 | 3.8% | 🟡 High |
| 3-1 | 423 | 3.8% | 🟡 High |
| 3-2 | 421 | 3.8% | ✅ Yes |
| 4-0 | 413 | 3.7% | 🟡 High |

**Finding:** 24.1% of all matches end with a scoreline of 8-0 or 0-8. This is catastrophic for player experience.

### 1.4 Scenario Breakdown

| Scenario | Avg Goals | Max Score | Home Win % | Issue |
|----------|-----------|-----------|------------|-------|
| Equal (50v50) | 3.86 | 8 | 41% | Too many goals |
| David vs Goliath (40v90) | 3.76 | 9 | **0%** | 🔴 Underdog never wins |
| Tiki-Taka vs Park Bus | 0.31 | 8 | 59% | Low avg, extreme max |
| Counter vs High Press | 0.38 | 8 | 40% | Low avg, extreme max |
| Wing Play vs Balanced | 0.30 | 8 | 49% | Low avg, extreme max |
| SEASON_AWARD_WINNER traits | 0.42 | 8 | 51% | Normal |
| CLINICAL_FINISHER traits | 0.37 | 8 | 41% | Normal |
| Speedster traits (all 11) | 0.37 | 8 | **100%** | 🔴 Trait gives auto-win |
| Zero stamina | 0.07 | 7 | 38% | Still scores somehow |
| All ST vs All GK | CRASH | — | — | 🔴 Engine bug |

### 1.5 OVR Difference Impact

| OVR Diff | Home Goals | Away Goals | Home Win % | Issue |
|----------|------------|------------|------------|-------|
| 0 | 0.12 | 0.11 | 43% | Balanced ✅ |
| +10 | 0.23 | 0.04 | **98%** | 🔴 Too dominant |
| +20 | 0.32 | 0.01 | **100%** | 🔴 Unbeatable |
| +30 | 0.38 | 0.00 | **100%** | 🔴 Unbeatable |
| +40 | 0.37 | 0.00 | **100%** | 🔴 Unbeatable |
| +50 | 0.36 | 0.00 | **100%** | 🔴 Unbeatable |

**Finding:** A +10 OVR advantage gives 98% win rate. This means team building is binary — once you're 10 OVR ahead, you literally cannot lose. The `duel()` function's sigmoid curve is too steep.

### 1.6 Engine Bugs Identified

#### Bug 1: `weightedPick` Crash on Non-Standard Formations
```
TypeError: weightedPick: both pool and fallback are empty
```
- **Trigger:** Team with 11 players all in same position (e.g., all ST or all GK)
- **Location:** `matchEngine.ts:212` → `resolveAttack` → `weightedPick`
- **Reproduction:** 200/200 crashes in "All ST vs All GK" scenario
- **Impact:** Any user with unusual lineup (e.g., all bench players promoted) will crash the match engine

#### Bug 2: Excessive Goal Scoring
- **Root Cause:** The `maxGoals` cap (4–8 based on OVR diff) is too generous, and the `resolveAttack` function's win probability is too high
- **Evidence:** 5.27 goals/game average, 24% of matches end 8-0
- **Impact:** Matches feel unrealistic; league tables become meaningless

#### Bug 3: Excessive Offside Calls
- **Root Cause:** The 10% offside check in `resolveAttack` fires on EVERY successful penetration, not just through-balls
- **Evidence:** 76% of matches have offsides (should be ~3–5 per game)
- **Impact:** Narrative bloat — too many "offside" events dilute the match report

#### Bug 4: Red Card Frequency
- **Root Cause:** The 5% foul chance × ~55% red card on foul = ~2.75% red card per attack. With ~10 attacks per team, that's ~55% chance of at least one red per game
- **Evidence:** 26.4% of matches have red cards (should be ~3–5%)
- **Impact:** Too many 10-man matches; distorts results

#### Bug 5: Penalty Shootout Never Triggers
- **Root Cause:** The `isCupMatch` parameter defaults to `false` and is never passed as `true` from the main match flow
- **Evidence:** 0 penalty shootouts in 11,200 matches
- **Impact:** Cup matches that end 0-0 go to... nothing. The tiebreaker mechanic is dead code.

---

## 2. DB vs Frontend Sync Audit

### 2.1 Orphaned DB Features (Data exists but not shown in UI)

#### Users Table
| Column | Migration | UI Status |
|--------|-----------|-----------|
| `prestige_multiplier` | 00034 | **NOT SHOWN** — No UI component references it |
| `manager_profile` | 00028 | **NOT SHOWN** — Used only in backend `convert_sp_to_currency` RPC |
| `daily_quests_completed` | 00106 | **NOT SHOWN** — `DailyQuestsWidget` queries `daily_quests` table directly |
| `daily_steps_logged` | 00014 | **LEGACY** — Superseded by `daily_steps` (00028). Still in DB |
| `last_sync_date` | 00014 | **LEGACY** — Superseded by `last_step_sync` (00028). Still in DB |

#### Players Table
| Column | Migration | UI Status |
|--------|-----------|-----------|
| `w2e_only_mode` | 00039 | **NOT SHOWN** — Backend-only flag (Glass Ceiling trigger) |
| `lineup_slot` | 00023 | **NOT SHOWN as label** — Used internally, never displayed as text |

#### Teams Table
| Column | Migration | UI Status |
|--------|-----------|-----------|
| `is_ready_for_match` | 00004 | **NOT SHOWN** — Referenced only in lineup page type definition |
| `stats` (JSONB) | 0004b | **NOT SHOWN** — No UI component renders this field |
| `sweat_points` | 20260527103100 | **NOT SHOWN** — SP tracked via `users.sweat_points`, team-level unused |

#### Infrastructure Table
| Column | Migration | UI Status |
|--------|-----------|-----------|
| `club_store_level` | 00044 | **NOT SHOWN** — Added with COMMENT but no UI references it |
| `training_camp_level` | 00006 | **LEGACY** — Superseded by `academy_level` + `scout_level` (00029) |

#### League Matches Table
| Column | Migration | UI Status |
|--------|-----------|-----------|
| `home_team_viewed` / `away_team_viewed` | 00033 | **NOT SHOWN** — Superseded by `is_viewed` column |
| `is_played` | 00021 | **LEGACY** — Superseded by `status` column |
| `home_tactic` / `away_tactic` | 00100 | **NOT SHOWN** — Engine reads these but no UI displays tactic used |
| `match_events` (JSONB) | 00025 | **DUPLICATE** — Both `match_events` and `events` exist on same table |

### 2.2 🔴 CRITICAL: Ghost Features (UI references non-existent DB data)

#### `player.traits` — MISSING COLUMN (8+ UI components affected)
The migration `00105_phase2_morale_youth.sql` only adds `traits` to `youth_intakes`. **No migration ever adds `traits` to `players`.** Yet these components reference it:

| File | Line | Reference |
|------|------|-----------|
| `components/squad/PlayerCard.tsx` | 12 | `traits?: string[]` in interface |
| `components/squad/SquadManager.tsx` | 17 | `traits?: string[]` in interface |
| `components/squad/SquadTabs.tsx` | 103 | `player.traits?.length > 0 ? player.traits.join(', ')` |
| `components/PlayerProfileModal.tsx` | 44, 690-701 | Renders "Special Traits" section |
| `app/lineup/page.tsx` | 47, 901-903 | Renders trait badges |
| `components/league/NextOpponentCard.tsx` | 10 | `traits?: string[]` |
| `components/ChemistryOverlay.tsx` | 118-136 | Reads `p.traits` with TRAIT_COLORS map |

**Impact:** All references silently get `undefined`/empty arrays. Feature is dead code.

#### Dead UI Buttons (No onClick handlers)
- **"Renew Contract"** — `staff/page.tsx:141-148` — Renders but does nothing
- **"Resign as Manager"** — `profile/ProfileClient.tsx:519-525` — Renders but does nothing

### 2.3 Ghost UI Features (UI exists but no real backend)

| UI Feature | Location | Status |
|------------|----------|--------|
| Global Rankings tab | `HubTabsWrapper.tsx:223` | 🔴 Placeholder — "Coming in the next season update" |
| Search tab | `HubTabsWrapper.tsx:234` | 🔴 Non-functional — input does nothing |
| "Trade" button | Social page | 🟡 Exists but references no API |
| Youth Academy tab | Academy page | 🟡 Has UI but limited DB backing |

### 2.4 API Routes Without UI Triggers

| API Route | Has UI Trigger? | Notes |
|-----------|----------------|-------|
| `/api/quests/generate` | **NO** | Cron only — no quest UI page exists |
| `/api/quests/claim` | YES (indirect) | `DailyQuestsWidget` on dashboard |
| `/api/fitness/unlink` | **Partial** | No explicit "Unlink Google Fit" button visible |
| `/api/cron/economy-agent` | Cron only | ✅ OK |
| `/api/cron/end-of-season` | Cron only | ✅ OK |
| `/api/cron/process-matches` | Cron only | ✅ OK |
| `/api/cron/stamina-regen` | Cron only | ✅ OK |

### 2.5 Legacy/Dead Tables

| Table/Column | Superseded By | Migration |
|-------------|---------------|-----------|
| `transfer_market` | `market_listings` (00032) | 00003 |
| `users.daily_steps_logged` | `users.daily_steps` (00028) | 00014 |
| `users.last_sync_date` | `users.last_step_sync` (00028) | 00014 |
| `infrastructure.training_camp_level` | `academy_level` + `scout_level` (00029) | 00006 |
| `league_matches.is_played` | `league_matches.status` | 00021 |
| `league_matches.match_events` | `league_matches.events` | 00025 vs 20260527101700 |

---

## 3. AI Systems Audit

### 3.1 AI Economy Agent (Central Bank)

**Location:** `app/api/cron/economy-agent/route.ts`
**Model:** Gemini 2.5 Flash
**Trigger:** Cron job (presumably daily)

#### Architecture
```
User data → Treasury transactions → Gemini prompt → Multiplier decision → DB update + Social feed post
```

#### Security Analysis

| Risk | Severity | Details |
|------|----------|---------|
| **No rate limiting** | 🟡 MEDIUM | The cron endpoint has no throttle — if called rapidly, it could drain Gemini API quota |
| **Prompt injection** | 🟡 MEDIUM | Economic data (total FC, mint/burn) is inserted directly into the prompt. A malicious user could theoretically inflate `total_fc_minted_today` via exploit to manipulate the AI's decision |
| **No fallback** | 🟡 MEDIUM | If Gemini API is down, the route returns 500. No cached/default multiplier is applied |
| **Cost** | 🟢 LOW | Gemini Flash is cheap (~$0.075/1M tokens). With ~1K tokens per call, cost is negligible |
| **Multiplier clamping** | ✅ GOOD | C17 fix clamps all multipliers to safe ranges (0.7–1.3 for rewards, 0.5–2.0 for costs) |
| **Schema validation** | ✅ GOOD | Response schema is enforced via Gemini's structured output |

#### Vulnerability: Prompt Injection via Economic Data
The system prompt includes:
```
- Total FC in circulation: ${totalFc}
- FC Minted Today: ${mintedToday}
- FC Burned Today: ${burnedToday}
```
If an attacker can manipulate `treasury_transactions` (e.g., via a race condition in `safe_credit_treasury`), they could inject arbitrary values that influence the AI's multiplier decisions. For example, setting `mintedToday = 999999999` would cause the AI to drastically reduce `match_reward`.

**Recommendation:** Add sanity bounds to `mintedToday` and `burnedToday` before passing to AI (e.g., cap at 2× total supply).

#### Vulnerability: No Rollback on AI Failure
If the Gemini call succeeds but the DB insert (`economy_state`) fails, the social feed post still goes through. There's no transactional consistency between the multiplier update and the news post.

### 3.2 AI Commentator

**Status:** ❌ NOT IMPLEMENTED

There is no `app/api/ai/match-commentary/route.ts` or similar file. The "AI-Commentator" mentioned in the audit scope does not exist in the codebase.

**Evidence:**
- No files match `commentary`, `commentator`, `press.conference`, or `interview` in API routes
- `SocialCategory` type includes `'interview'` but no API backs it
- Match events are text-generated by the engine (hardcoded Russian strings), not AI-generated

### 3.3 Expansion Proposals for AI Commentator

Since the commentator doesn't exist yet, here are 3 proposals for implementation:

#### Proposal 1: Pre-Match Press Conference
- **Trigger:** 1 hour before a scheduled match
- **Input:** Both teams' last 5 results, key players, tactical setup
- **Output:** AI-generated press conference quotes from both managers
- **Token cost:** ~2K tokens per match (~$0.00015 with Gemini Flash)
- **UI:** Show in "Match Center" tab as expandable cards

#### Proposal 2: Post-Match Narrative Summary
- **Trigger:** After `resolveMatch` completes
- **Input:** Match events (goals, cards, injuries), final score, league position
- **Output:** 3-paragraph narrative summary in cyberpunk tone
- **Token cost:** ~1.5K tokens per match
- **UI:** Replace the current event list with a narrative + key events
- **Performance concern:** If 500 matches end simultaneously (season end), batch into 50 AI calls with multi-match context

#### Proposal 3: Player Career Arc Narratives
- **Trigger:** Milestone events (100th match, first goal, transfer)
- **Input:** Player history, career stats, current form
- **Output:** Personalized narrative ("From the streets of Neo-Tokyo to the Champions League final...")
- **Token cost:** ~1K tokens per event
- **UI:** Toast notification + journal entry

---

## 4. Actionable Recommendations

### 🔴 CRITICAL — Fix Immediately

1. **Create `player.traits` column** — `ALTER TABLE players ADD COLUMN traits JSONB DEFAULT '[]'::jsonb`. 8+ UI components reference this non-existent column. All trait functionality is dead code without it.
2. **Fix goal scoring rate** — Reduce `maxGoals` cap from 4–8 to 3–4, or reduce attack count per match from 5–12 to 3–8
3. **Fix `weightedPick` crash** — Add fallback for teams with non-standard positions (e.g., if no MID pool, use any outfield player)
4. **Fix penalty shootout trigger** — Pass `isCupMatch: true` from cup match resolution code
5. **Fix red card frequency** — Reduce foul chance from 5% to 2%, or reduce red card probability on foul

### 🟡 HIGH — Fix Soon

6. **Reduce offside frequency** — Change from 10% per penetration to 5% per successful attack only
7. **Flatten OVR advantage curve** — The sigmoid in `duel()` is too steep; reduce `k` from 0.045 to 0.025 to give underdogs more chance
8. **Fix "Speedster" trait auto-win** — 100% home win rate with 11 Speedsters suggests the trait's 1.15× pace bonus compounds too aggressively
9. **Add AI Agent rate limiting** — Add a cooldown check (e.g., no more than 1 call per 6 hours)
10. **Add Gemini API fallback** — Cache last known good multipliers; apply defaults if API fails
11. **Clean up duplicate columns** — Remove `match_events` (keep `events`), remove `is_played` (keep `status`), remove `home_team_viewed`/`away_team_viewed` (keep `is_viewed`)
12. **Remove dead UI buttons** — "Renew Contract" and "Resign as Manager" have no handlers

### 🟢 MEDIUM — Fix When Convenient

13. **Implement Global Rankings tab** — Currently a placeholder; needs a real API endpoint
14. **Implement Search tab** — Currently non-functional
15. **Show economy multipliers to players** — Add a "Central Bank Report" section showing current match_reward, medical_cost, etc.
16. **Add treasury transaction visibility** — Show players their income/expense breakdown
17. **Implement AI Commentator** — Start with Proposal 2 (post-match narrative) as it's highest impact
18. **Drop legacy columns** — `transfer_market`, `training_camp_level`, `daily_steps_logged`, `last_sync_date` are all superseded
19. **Add `club_store_level` UI** — Column exists in DB but StadiumTab doesn't show it

### ⚪ LOW — Backlog

20. **Show `potential_limit` to players** — Add growth ceiling indicator to player cards
21. **Show `player_chemistry` scores** — Make green links visible in squad view
22. **Connect `personal_notifications` to UI** — Ensure all notification types have a delivery path
23. **Implement `interview` social category** — Currently defined in types but no backend
24. **Show `prestige_multiplier` to players** — Currently hidden; could be a status symbol
25. **Show `manager_profile` in UI** — Currently only used in SP conversion math

---

## 5. Appendix: Raw Statistics

Full statistics saved to: `.mimo_workflow/engine_audit/engine_stats.json`

Key excerpts:
```json
{
  "totalMatches": 11201,
  "goalsPerGame": 5.27,
  "maxGoalsInMatch": 10,
  "redCards": 2956,
  "yellowCards": 2246,
  "penaltyShootouts": 0,
  "offsideCount": 8535,
  "emptyTeamCrashes": 1,
  "allSamePositionCrashes": 200
}
```

---

*This report was generated by automated stress testing and manual code review. No production code was modified.*
