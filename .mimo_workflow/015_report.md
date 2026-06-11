# Task 015 Report: Match Engine V4.0 Frontend & Integration

## Changes Implemented

### 1. Backend & Database

**Migration `00100_match_tactics.sql`:**
- Added `home_tactic` and `away_tactic` columns to `league_matches` table
- Default value `'Balanced'` for backward compatibility

**`app/actions/lineupActions.ts`:**
- Created `updateTeamTactic(tactic: string)` server action
- Validates tactic against allowed list: `['Tiki-Taka', 'Counter Attack', 'High Press', 'Park the Bus', 'Wing Play', 'Balanced']`
- Updates `teams.tactic` column for current user (cookie auth)
- Revalidates `/lineup` path

**`app/actions/matchActions.ts`:**
- `resolveMatch`: Now fetches `home_tactic` and `away_tactic` from `teams` table for both teams
- Passes tactics to `runMatchEngine()` as 7th and 8th parameters
- Stores `home_tactic` and `away_tactic` in `league_matches` when saving match result
- `getMatchHistory`: Now includes `home_tactic` and `away_tactic` in returned data
- `getUnviewedMatch`: Now includes `home_tactic` and `away_tactic` in report object

**`app/api/matches/recent/route.ts`:**
- Added `home_tactic` and `away_tactic` to the SELECT query

### 2. Tactics UI (`app/lineup/page.tsx`)

- Added `tactic` field to `Team` interface
- Added `activeTactic` state (default: `'Balanced'`)
- Added `isTacticLoading` state for optimistic UI
- Load tactic from `team.tactic` in `fetchTeamData`
- Added `handleTacticChange` function with:
  - Optimistic UI update
  - Rollback on error
  - Toast notifications (saved/failed)
- Added Tactic Selector UI in INFO tab:
  - Horizontal scrollable row of 6 tactic pills
  - Active tactic highlighted with cyan glow
  - Disabled state during loading
  - Positioned between stats grid and Management cards

### 3. Match Report UI (`components/MatchReportModal.tsx`)

**New lucide-react icons for event types:**
- `offside` → `Flag` (yellow)
- `crossbar` → `CircleDot` (cyan)
- `own_goal` → `AlertTriangle` (red)
- `penalty_save` → `CheckCircle` (green)
- `second_yellow` → `AlertCircle` (yellow)
- `red_card` → `Square` (filled red)

**Tactics display:**
- Added `home_tactic` and `away_tactic` to `MatchReport` interface
- Tactics shown below the score in the header
- Each team's tactic displayed on their side
- "TACTIC" label centered between them
- Conditional rendering: only shown if tactics are present

### 4. Dictionary Keys

**English (`en`):**
- `lineup_tactic`: "TACTIC"
- `lineup_tactic_saved`: "Tactic Saved"
- `lineup_failed_tactic`: "Failed to change tactic"
- `lineup_network_tactic`: "Network error during tactic change."
- `report_tactic_label`: "Tactic"

**Russian (`ru`):**
- `lineup_tactic`: "ТАКТИКА"
- `lineup_tactic_saved`: "Тактика сохранена"
- `lineup_failed_tactic`: "Не удалось изменить тактику"
- `lineup_network_tactic`: "Ошибка сети при смене тактики."
- `report_tactic_label`: "Тактика"

## Files Modified
- `supabase/migrations/00100_match_tactics.sql` (new)
- `app/actions/lineupActions.ts` — added `updateTeamTactic`
- `app/actions/matchActions.ts` — fetch/store tactics, pass to engine
- `app/api/matches/recent/route.ts` — select tactic columns
- `app/lineup/page.tsx` — tactic selector UI
- `components/MatchReportModal.tsx` — tactics display + new event icons
- `app/page.tsx` — pass tactics to match report
- `lib/dictionaries.ts` — new i18n keys (EN + RU)

## Verification
- `npx tsc --noEmit` passes with zero errors
- Tactic selector renders on lineup page (INFO tab)
- Selecting a tactic saves to DB and persists
- `resolveMatch` passes tactics to engine (visible in kickoff event text)
- Match report shows tactics for both teams
- New event types have distinct lucide-react icons
- All dictionary keys present in both EN and RU
