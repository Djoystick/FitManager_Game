# FitManager Changelog

All notable changes to this project will be documented in this file.

## [v1.3.0] - 2026-06-10

### Added
- **Google Fit Integration (Production-Ready)**: Full OAuth 2.0 implementation with Google API Services to synchronize real-world step data directly into the game's `Sweat Bank`.
- **Legal Compliance Modals**: Deployed comprehensive Google-compliant "Privacy Policy" and "Terms of Service" static pages (`/privacy`, `/terms`) and integrated them directly into the full-screen Game Profile Modals to satisfy OAuth Verification requirements.
- **Strict Locale Priority System**: Improved the dual-language (RU/EN) logic. The app now strictly adheres to the user's `Telegram` language code. It only falls back to the browser's `navigator.language` if Telegram data is unavailable, defaulting securely to English.

## [v1.2.0] - 2026-06-09
### Security
- **Secure Backend Proof of Ownership**: Completely rewrote the TON Wallet connection mechanism to comply with maximum security standards. We now cryptographically verify `Ed25519` `ton_proof` signatures directly on the backend using the official `@ton/core` and `@ton/crypto` libraries.
- **Anti-Replay Protection**: The connection payload is now a stateless JWT with a 15-minute expiration time, uniquely bound to the Telegram `userId` requesting it. This prevents interception, hijacking, or re-use of signatures.

## [v1.1.0] - 2026-06-09

### Added
- **Deep Onboarding Flow**: Implemented a comprehensive 9-step interactive tutorial that guides new managers through the completely redesigned 5-tab UI ecosystem.
- **Dynamic Feature Unlocking**: The bottom navigation bar now unlocks progressively, preventing players from feeling overwhelmed and forcing them to explore features in a logical order.
- **Friendly Matches Return**: Reinstated the `FriendlyMatchCard` component inside the League (Hub) tab, giving players an immediate gameplay loop to test their squad while waiting for the official league to start.
- **"Memory Mechanism" Established**: New rigid rule enforced via `project_rules.md` requiring all major updates to be logged here and drafted as Telegram devblog posts.

### Fixed
- **Sweat Bank Sync Bug**: Fixed a critical issue where the fitness sync widget incorrectly pulled `daily_steps_logged` from the database instead of `daily_steps`, resulting in the UI incorrectly showing 0 steps after a page refresh.
