# Task 002: Security Patch - Phase 2 (Authentication Migration)

## Context
You are continuing your work as a Junior Developer fixing vulnerabilities. Supervised by the Senior Architect.

## STRICT RULES OF ENGAGEMENT
1. **DO NOT** modify any UI components, CSS files, or frontend layouts.
2. **DO NOT** create or modify Supabase SQL migrations.
3. **DO NOT** delete any files.
4. **ONLY** modify the files explicitly listed in the "Tasks" section below.

## Tasks
Your goal is to fix the remaining instances of the **C1 Critical Vulnerability** (Account Takeover via `userId` spoofing).

### Task: Migrate to Cookie-based Authentication
**Files to modify**:
1. `app/api/infrastructure/route.ts` (Both GET and POST if applicable)
2. `app/api/league/standings/route.ts`
3. `app/api/lineup/formation/route.ts`
4. `app/api/lineup/swap/route.ts`
5. `app/api/market/list/route.ts`
6. `app/api/user/me/route.ts`
7. `app/api/achievements/route.ts`
8. `app/api/notifications/route.ts`

**Bug**: These routes currently accept `userId` from the request JSON body or URL query parameters, which allows attackers to spoof requests for other users.
**Fix**:
1. Remove `userId` extraction from the JSON body (`req.json()`) or search parameters.
2. If `userId` is part of a TypeScript interface for the request body, remove it from the interface.
3. Import `cookies` from `next/headers`:
   ```typescript
   import { cookies } from 'next/headers';
   ```
4. Extract `userId` securely inside the route handler:
   ```typescript
   const cookieStore = cookies();
   const userId = cookieStore.get('tg_user_id')?.value;
   if (!userId) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```
5. Ensure the rest of the file compiles and uses the securely extracted `userId`.

## Output
When finished, write a short summary of what you did in `.mimo_workflow/002_report.md`.
