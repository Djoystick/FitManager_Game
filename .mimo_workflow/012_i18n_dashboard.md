# Task 012: Full i18n Sweep (Phase 1) - Dashboard & Modals

## Context
You are supervised by the Senior Architect. The user wants the application's interface language system to work perfectly. We already have `LanguageContext` and `lib/dictionaries.ts`, but many components contain hardcoded English strings.

**CRITICAL RULE**: "Technological" words must remain in English even in the Russian dictionary. Do NOT translate: `OVR`, `FanCoins`, `FC`, `SP`, `Sweat Points`, `TON`, `Tier`.

## Tasks

### 1. Refactor `app/page.tsx` (Dashboard)
Scan `app/page.tsx` for ALL hardcoded UI strings. Specifically look for:
- "League Standings", "Full Standings", "Your Position", "No standings data yet"
- "WAITING FOR TEAMS", "The league will start automatically."
- "vs", "R{match.round_number}"
- "Scout", "HOME", "AWAY"
- "OVR", "STA", "LVL" (ensure they use the dictionary if needed, but remember the rule)
- Any other hardcoded text inside render functions.

1. Inject `const { language } = useContext(LanguageContext);` and `const t = dict[language as keyof typeof dict] || dict['en'];` into any functional component that lacks it (e.g. `StandingsModal`, `MatchCard`, `CalendarMatchRow`, `NextHourCountdown`, etc.). *Hint: pass `t` as a prop if it's easier for small sub-components.*
2. Replace the hardcoded strings with dictionary references (e.g. `{t.waiting_for_teams}`).

### 2. Update `lib/dictionaries.ts`
Add all the extracted keys to BOTH the `en` and `ru` sections in `lib/dictionaries.ts`.
- Make sure the `en` section has proper English.
- Make sure the `ru` section has proper Russian, BUT keep `OVR`, `FanCoins`, `FC`, `SP`, `TON`, `Tier` in English.

## Output
Modify `app/page.tsx` and `lib/dictionaries.ts`. Run `npx tsc --noEmit` to ensure type safety (watch out for missing keys!). Write a short summary of the refactored components to `.mimo_workflow/012_report.md`.
