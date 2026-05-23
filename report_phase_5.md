# Phase 5: Telegram SDK Client Integration & Secure Authentication

## Overview
Phase 5 implements the critical authentication bridge between the Telegram mobile client and our Supabase backend. We utilized the standard `@twa-dev/sdk` client toolkit to extract the cryptographic `initData`, allowing the Next.js API to verify the identity of the user securely without traditional passwords.

## 1. SDK Installation & Client Provider
- **Package**: Installed `@twa-dev/sdk` as the primary interface to the Telegram Web App window object.
- **Provider (`components/TelegramAuthProvider.tsx`)**: 
  - Constructed a React Context Provider to wrap the root application, making `userId`, `isAuthenticated`, and `isLoading` states accessible to any future nested client component.
  - On mount, it calls `WebApp.ready()` and extracts the URL-encoded `initData`.
  - Implements a resilient local testing fallback: If `initData` is absent (i.e., running in Chrome on localhost instead of inside the Telegram app wrapper), it bypasses the API call and gracefully yields control, allowing local layout testing to continue unhindered.

## 2. Cryptographic Validation (`app/api/auth/telegram/route.ts`)
The server route strictly adheres to Telegram's WebApp authentication specifications to prevent spoofing or replay attacks.
- **HMAC-SHA-256 Validation**: 
  - Plucks the `hash` from `initData` and sorts all other parameters alphabetically (`auth_date`, `query_id`, `user`).
  - Uses the native Node.js `crypto` module to construct the Data Check String.
  - Validates it against two layers of HMAC hashing: `HMAC-SHA-256(HMAC-SHA-256("WebAppData", botToken), dataCheckString)`.
- **Expiration Controls**: Checks the `auth_date` timestamp. Any payload older than 24 hours is rejected with a `401 Unauthorized`.

## 3. Supabase User Synchronization
Once the cryptographic signature is verified, we implicitly trust the parsed `telegram_id`.
- The API uses the `@supabase/supabase-js` service connection.
- Performs a check against the `users` table. If the `telegram_id` matches an existing record, the backend maps them to the existing `id` UUID.
- If no record is found (new user), an `insert` command initializes their profile mapping in Supabase.
- The internal `user_id` is passed back to the client React Provider, authorizing the session for the frontend.

## Summary
The game now boasts an end-to-end silent authentication flow. A player launching the TMA from the Telegram bot is immediately recognized, verified, and mapped to their Supabase data structures natively.
