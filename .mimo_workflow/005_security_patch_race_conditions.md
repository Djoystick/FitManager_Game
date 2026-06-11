# Task 005: Security Patch - Phase 5 (Race Conditions in Finance)

## Context
You are supervised by the Senior Architect. This is the most critical phase. We must fix the "double-spend" race condition (C4) that allows infinite money glitches.

## STRICT RULES OF ENGAGEMENT
1. **EXCEPTION TO RULE**: For this task ONLY, you are allowed and required to create a new Supabase SQL migration file.
2. **DO NOT** modify UI or CSS.
3. **DO NOT** delete any files.

## Tasks
Your goal is to fix the C4 vulnerability (Read-Modify-Write Race Condition) in the Infrastructure upgrade endpoint.

### 1. Create Atomic RPC for Fancoins Deduction
**File**: Create a new file `supabase/migrations/00099_atomic_finance_rpc.sql`
- **Fix**: Write a PostgreSQL function that atomically deducts `balance_fancoins`. 
  ```sql
  CREATE OR REPLACE FUNCTION deduct_fancoins(user_id UUID, amount NUMERIC)
  RETURNS NUMERIC
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    new_balance NUMERIC;
  BEGIN
    UPDATE public.users 
    SET balance_fancoins = balance_fancoins - amount 
    WHERE id = user_id AND balance_fancoins >= amount
    RETURNING balance_fancoins INTO new_balance;

    IF new_balance IS NULL THEN
      RAISE EXCEPTION 'Insufficient funds or user not found';
    END IF;

    RETURN new_balance;
  END;
  $$;
  ```

### 2. Implement RPC in Infrastructure API
**File**: `app/api/infrastructure/route.ts`
- **Bug**: The POST route currently reads the user's balance, checks if it's enough, and then updates it. This is vulnerable to race conditions.
- **Fix**: Replace the read-modify-write block with a single atomic RPC call:
  ```typescript
  const { data: newBalance, error: deductError } = await supabase.rpc('deduct_fancoins', { 
    user_id: userId, 
    amount: upgradeCost 
  });
  
  if (deductError) {
    return NextResponse.json({ error: 'Insufficient funds or transaction failed' }, { status: 400 });
  }
  ```
  Remove the previous `select('balance_fancoins')` and the old `update` code entirely.

## Output
When finished, write a short summary of your fixes in `.mimo_workflow/005_report.md`.
