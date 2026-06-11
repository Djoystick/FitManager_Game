# Task 005 — Security Patch Phase 5 (Race Conditions in Finance) Report

## Summary
Fixed the C4 Critical Vulnerability (Read-Modify-Write Race Condition) in the Infrastructure upgrade endpoint by introducing an atomic PostgreSQL RPC for FanCoins deduction.

## Changes

### 1. New SQL Migration: `supabase/migrations/00099_atomic_finance_rpc.sql`
- Created `deduct_fancoins(user_id UUID, amount NUMERIC)` PostgreSQL function.
- Uses a single `UPDATE ... WHERE balance_fancoins >= amount` statement — the balance check and deduction happen atomically in one row lock.
- Returns the new balance on success; raises an exception on insufficient funds or missing user.
- `SECURITY DEFINER` ensures it executes with owner privileges.

### 2. Modified: `app/api/infrastructure/route.ts` (POST handler)
- **Removed**: The read-modify-write pattern (`select('balance_fancoins')` → client-side check → `update({ balance_fancoins: newBalance })`).
- **Replaced with**: A single `supabase.rpc('deduct_fancoins', { user_id, amount })` call that atomically deducts FanCoins and returns the new balance.
- **Removed**: The `Promise.all` pseudo-transaction that attempted to update user balance and infrastructure level simultaneously (non-atomic).
- **Kept**: The infrastructure level update as a separate step after successful deduction (infrastructure level is not financial and doesn't need atomic coupling).

## Race Condition Fix Explanation
**Before**: Two concurrent requests could both read `balance_fancoins = 5000`, both pass the `>= 3000` check, and both deduct — resulting in a negative balance (double-spend).

**After**: The `UPDATE ... WHERE balance_fancoins >= amount` statement acquires a row-level lock on the users table. Only one transaction can succeed; the second one finds the balance already reduced and raises an exception.

## Scope Compliance
- Created 1 new SQL migration file (explicitly allowed by task rules).
- Modified only the specified backend file (`app/api/infrastructure/route.ts`).
- No UI/CSS/frontend modified.
- No files deleted.
