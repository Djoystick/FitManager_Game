# Task 015: Match Engine V4.0 Frontend & Integration

## Context
You are supervised by the Senior Architect. The Match Engine V4 is ready on the backend (`matchEngine.ts`), but it currently defaults to 'Balanced' because the UI doesn't allow tactic selection and the database lacks a column to store it.

Your task is to implement the full UI and integration for the Engine V4.

## Tasks

### 1. Backend & Database
- If not already complete, verify the `supabase/migrations/00049_team_tactics.sql` file exists (adds `tactic text DEFAULT 'Balanced'` to `teams` table).
- In `app/actions/matchActions.ts`, update the `resolveMatch` function to fetch the `tactic` column for both the home and away team when querying the `teams` table. Note: currently `resolveMatch` fetches players, you may need to fetch the team tactic from `teams` first, or if `league_matches` doesn't have it, fetch it.
- Pass the loaded `homeTactic` and `awayTactic` to the `runMatchEngine(...)` call. (Note: you will need to add these as parameters to `runMatchEngine` or pass them in the config if not already matching the engine signature).
- Create a server action (e.g., in `lineupActions.ts` or a new file) `updateTeamTactic(tactic: string)` that updates the `tactic` column in the `teams` table for the current user.

### 2. Tactics UI (`app/lineup/page.tsx`)
- Add a Tactic Selector on the Lineup page.
- The 6 valid tactical styles are: `'Tiki-Taka' | 'Counter Attack' | 'High Press' | 'Park the Bus' | 'Wing Play' | 'Balanced'`.
- Let the user select a tactic and call `updateTeamTactic`.

### 3. Match Report UI (`components/MatchReportModal.tsx`)
- Update the modal to display the chosen tactic for both teams at the top of the report.
- The `events` array from the V4 engine now contains new types of events (e.g. Red Cards, Offsides, Crossbar hits). 
- Use `lucide-react` icons (e.g., `Square` colored red for red cards, `Flag` for offsides, `Flame` for momentum) to render these events beautifully. **Do not use plain emojis.** Apply our neon/glassmorphic CSS styles to the icons so they match the `Midnight Command Center` vibe.

## Output
Modify the required files. Run `npx tsc --noEmit` to ensure type safety. Write your report to `.mimo_workflow/015_report.md`.
