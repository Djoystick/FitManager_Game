# Task 001 — Security Patch (Phase 1) Report

## Task A: Fix C13 — Friendly Match Logic

**File**: `app/api/league/friendly/route.ts`  
**Line 45**: Changed `.eq('lineup_status', 'starter')` → `.eq('lineup_status', 'starting')`  
**Reason**: Typo caused the friendly match to never find any starting players, breaking OVR calculation.

## Task B: Fix C1 — Account Takeover / Auth Bypass

### File 1: `app/api/fitness/log/route.ts`
- Added `import { cookies } from 'next/headers';` (line 2)
- Removed `userId` from `FitnessLogRequest` interface and from body destructuring
- Removed the `userId` check from basic validation
- Added secure `userId` extraction via `cookies().get('tg_user_id')?.value` with 401 Unauthorized guard
- Updated the validation error message to reflect the remaining required fields

### File 2: `app/api/user/complete-onboarding/route.ts`
- Added `import { cookies } from 'next/headers';` (line 2)
- Removed `const { userId } = await req.json();`
- Removed the body-based `userId` check
- Added secure `userId` extraction via `cookies().get('tg_user_id')?.value` with 401 Unauthorized guard

## Summary

All changes are minimal and strictly scoped to backend API route logic. No UI, CSS, migrations, or files were created/deleted. The `userId` is now exclusively sourced from the `tg_user_id` cookie in both vulnerable routes, eliminating the ability for attackers to spoof requests for arbitrary users.
