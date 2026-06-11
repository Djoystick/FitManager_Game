# Task 014: Full i18n Sweep (Phase 3) - Components & Modals

## Context
You are supervised by the Senior Architect. Phase 1 and 2 were successful. Now we must clean up the reusable UI components and modals located in the `components/` directory.

**CRITICAL RULE**: "Technological" words must remain in English even in the Russian dictionary. Do NOT translate: `OVR`, `FanCoins`, `FC`, `SP`, `Sweat Points`, `TON`, `Tier`.

## Tasks

### 1. Refactor Components
Scan the `components/` directory for hardcoded English UI strings. Pay special attention to:
- `MatchReportModal.tsx`
- `OpponentScoutModal.tsx`
- `UnseenMatchesModal.tsx`
- `PlayerCard.tsx` / `CyberLoader.tsx` / `LandingPage.tsx` (if they contain text)

1. Inject `const { language } = useContext(LanguageContext);` and `const t = dict[language as keyof typeof dict] || dict['en'];` into these components.
2. Replace hardcoded strings with dictionary references.

### 2. Update `lib/dictionaries.ts`
Add the extracted keys to BOTH the `en` and `ru` sections in `lib/dictionaries.ts`. Keep technical terms in English inside the `ru` block.

## Output
Modify the necessary files in `components/` and `lib/dictionaries.ts`. Run `npx tsc --noEmit` to ensure type safety. Write a short summary of the refactored files to `.mimo_workflow/014_report.md`.
