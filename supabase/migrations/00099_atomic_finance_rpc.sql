-- Atomic FanCoins deduction RPC (C4 fix)
-- Prevents double-spend race condition by using a single UPDATE with WHERE guard.

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
