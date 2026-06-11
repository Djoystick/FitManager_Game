# Task 002 — Security Patch Phase 2 (Authentication Migration) Report

## Summary
Migrated all 8 API routes from body/query-parameter-based `userId` to secure cookie-based extraction via `cookies().get('tg_user_id')`. This eliminates the C1 Critical Vulnerability (Account Takeover) across the remaining endpoints.

## Changes Per File

### 1. `app/api/infrastructure/route.ts`
- **GET**: Removed `searchParams.get('userId')`. Added `cookies` import and cookie-based `userId` extraction with 401 guard.
- **POST**: Removed `userId` from `req.json()` destructuring. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 2. `app/api/league/standings/route.ts`
- **GET**: Removed `searchParams.get('userId')`. Added `cookies` import and cookie-based `userId` extraction with 401 guard. Removed the conditional `if (userId)` wrapper (userId is now always present or 401 is returned).

### 3. `app/api/lineup/formation/route.ts`
- **PUT**: Removed `userId` from `req.json()` destructuring. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 4. `app/api/lineup/swap/route.ts`
- **POST**: Removed `userId` from `req.json()` destructuring. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 5. `app/api/market/list/route.ts`
- **POST**: Removed `userId` from `MarketListRequest` interface and from `req.json()` destructuring. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 6. `app/api/user/me/route.ts`
- **GET**: Removed `searchParams.get('userId')`. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 7. `app/api/achievements/route.ts`
- **GET**: Removed `searchParams.get('userId')`. Added `cookies` import and cookie-based `userId` extraction with 401 guard.

### 8. `app/api/notifications/route.ts`
- **GET**: Removed `searchParams.get('userId')`. Added `cookies` import and cookie-based `userId` extraction with 401 guard.
- **POST**: No `userId` spoofing vector (accepts only `notificationIds`). Left unchanged.

## Scope Compliance
- No UI/CSS/frontend modified.
- No SQL migrations created or modified.
- No files deleted.
- Only the 8 explicitly listed files were modified.
