# Phase 15: Stage 4.5 UI Polish & Localization

## Typography Upgrades
- Imported **Orbitron** (for standard numeric displays and latin text headers) and **Russo One** (for Cyrillic-compatible headers and buttons) from Google Fonts via Next.js `next/font/google`.
- Declared custom CSS variables (`--font-orbitron`, `--font-russo`) and extended the Tailwind theme so they can be easily used as `font-orbitron` and `font-russo`.

## Lightweight Localization (i18n)
- Created a robust yet lightweight dictionary configuration in `lib/dictionaries.ts` mapping English and Russian texts.
- Implemented `LanguageContext` using pure React Context to keep the bundle size small (bypassing heavy packages like `next-i18next`).
- The `LanguageProvider` surrounds the `TelegramAuthProvider`, which allows the app to maintain global state for language preferences without hydration mismatch issues.

## Telegram Integration
- Tapped into `WebApp.initDataUnsafe?.user?.language_code` upon client mount.
- If the language defaults to 'ru', we update the `LanguageContext` to trigger a global UI refresh to Russian string variations.

## Application in the UI
- **Dashboard (`app/page.tsx`)**: Refactored the dashboard to actively consume the `LanguageContext`.
- Dynamically swaps between `font-russo` and `font-orbitron` depending on the current active language (ensuring typography handles Cyrillic elegantly).
- Mapped all hardcoded string literals into the new dictionary model, bringing proper localization to the core UI.
