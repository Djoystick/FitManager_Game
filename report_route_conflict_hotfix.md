# Parallel Pages Route Conflict Hotfix Report
**Date:** 2026-05-24
**Component:** Next.js Routing (App Router)

## SUMMARY
This report details the resolution of a Next.js (Turbopack) build error caused by conflicting parallel routes pointing to the same `/league` URL segment.

### Executed Actions
1. **Architecture Merge:**
   - Evaluated the legacy client-side dashboard (`app/league/page.tsx`) and the modern Server Component dashboard (`app/(game)/league/page.tsx`).
   - Merged the "Recent Matches" history module from the legacy version into the new Server Component.
   - Refactored the UI to use a 2-column grid displaying both Recent Matches and the League Standings table alongside the new `PlayMatchButton`.
   
2. **Conflict Resolution:**
   - **Deleted:** The legacy `app/league` directory was fully removed from the filesystem.
   - The only remaining route is `app/(game)/league/page.tsx`, effectively eliminating the "You cannot have two parallel pages that resolve to the same path" conflict.

### Deployment Status
The Next.js App Router tree is now clean. Turbopack will no longer fail on the `/league` route conflict. The application utilizes the robust Server Component variant under the `(game)` layout group.
