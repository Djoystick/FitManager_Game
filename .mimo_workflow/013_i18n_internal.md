# Task 013: Full i18n Sweep (Phase 2) - Internal Pages

## Context
You are supervised by the Senior Architect. Phase 1 (Dashboard) was successful. Now we must clean up the internal routing pages of the app.

**CRITICAL RULE**: "Technological" words must remain in English even in the Russian dictionary. Do NOT translate: `OVR`, `FanCoins`, `FC`, `SP`, `Sweat Points`, `TON`, `Tier`.

## Tasks

### 1. Refactor Internal Pages
Scan the following files for ALL hardcoded English UI strings:
- `app/lineup/page.tsx`
- `app/market/page.tsx`
- `app/bank/page.tsx`
- `app/onboarding/page.tsx`

1. Inject `const { language } = useContext(LanguageContext);` and `const t = dict[language as keyof typeof dict] || dict['en'];` into any components inside these files that lack them.
2. Replace the hardcoded strings with dictionary references (e.g. `{t.market_buy_confirm}`).
3. Watch out for string literals in `placeholder` attributes of inputs, `title` attributes, or error messages thrown via `toast`.

### 2. Update `lib/dictionaries.ts`
Add all the newly extracted keys to BOTH the `en` and `ru` sections in `lib/dictionaries.ts`.
- Make sure the `ru` section has proper Russian, BUT keep the technical terms (`OVR`, `TON`, `FC`, etc.) in English as requested.

## Output
Modify the 4 page files and `lib/dictionaries.ts`. Run `npx tsc --noEmit` to ensure type safety. Write a short summary of the refactored components to `.mimo_workflow/013_report.md`.
