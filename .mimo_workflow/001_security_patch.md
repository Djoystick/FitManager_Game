# Task 001: Security Patch (Phase 1)

## Context
You are acting as a Junior Developer fixing vulnerabilities found in the recent security audit. You will be supervised by the Senior Architect.

## STRICT RULES OF ENGAGEMENT
1. **DO NOT** modify any UI components, CSS files, or frontend layouts.
2. **DO NOT** create or modify Supabase SQL migrations.
3. **DO NOT** delete any files.
4. **ONLY** modify the files explicitly listed in the "Tasks" section below.

## Tasks
Your goal is to fix two critical vulnerabilities from the audit:

### Task A: Fix C13 (Friendly Match Logic)
**File to modify**: `app/api/league/friendly/route.ts`
- **Bug**: The query looks for `.eq('lineup_status', 'starter')`. This is a typo.
- **Fix**: Change it to `.eq('lineup_status', 'starting')`.

### Task B: Fix C1 (Account Takeover / Auth Bypass)
**Files to modify**: 
1. `app/api/fitness/log/route.ts`
2. `app/api/user/complete-onboarding/route.ts`
- **Bug**: These routes currently accept `userId` from the request body, which allows attackers to spoof requests for other users.
- **Fix**: 
  - Remove `userId` extraction from the JSON body.
  - Instead, securely extract the user ID using the Next.js cookies API:
    ```typescript
    import { cookies } from 'next/headers';
    // ... inside the route handler
    const cookieStore = cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    ```
  - Ensure the rest of the route logic uses this secure `userId`.

## Output
When finished, write a short summary of exactly what lines you changed in `.mimo_workflow/001_report.md`.
