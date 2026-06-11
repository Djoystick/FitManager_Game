# Task 003: Security Patch - Phase 3 (Cron & Webhook Security)

## Context
You are supervised by the Senior Architect. This phase focuses on securing our automated backend endpoints from external manipulation.

## STRICT RULES OF ENGAGEMENT
1. **DO NOT** modify UI, CSS, or Database Migrations.
2. **DO NOT** delete any files.
3. **ONLY** modify the specified backend files.

## Tasks
Your goal is to fix vulnerabilities C2, C5, C6, C7, and C8.

### 1. Fix Webhook Auth (C2 & C6)
**File**: `app/api/bot/register/route.ts`
- **Bug**: The endpoint is completely unauthenticated.
- **Fix**: Require `CRON_SECRET` authorization.
  ```typescript
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```

### 2. Fix Localhost Auth Bypass (C8)
**Files**: 
- `app/api/cron/stamina-regen/route.ts`
- `app/api/cron/age-players/route.ts`
- **Bug**: They use `if (!request.url.includes('localhost'))` for auth, which is easily bypassed in production.
- **Fix**: Replace the localhost check with the standard `CRON_SECRET` Bearer token check shown above.

### 3. Fix Economy Agent Conditional Bypass (C5)
**File**: `app/api/cron/economy-agent/route.ts`
- **Bug**: The check `if (process.env.CRON_SECRET && authHeader !== ...)` allows anyone to bypass auth if `CRON_SECRET` is unset.
- **Fix**: Change the logic to fail if the secret is missing or mismatched:
  ```typescript
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }
  ```

### 4. Remove Fallback JWT Secret (C7)
**File**: `app/actions/marketActions.ts`
- **Bug**: `const jwtSecret = process.env.CRON_SECRET || 'fallback_secret_for_jwt';`
- **Fix**: Remove the fallback. Throw an error if `process.env.CRON_SECRET` is undefined before signing/verifying.
  ```typescript
  const jwtSecret = process.env.CRON_SECRET;
  if (!jwtSecret) throw new Error("CRON_SECRET is not configured");
  ```

## Output
When finished, write a short summary of your fixes in `.mimo_workflow/003_report.md`.
