-- 00080: Atomic Sweat Points RPC functions
-- Prevents race conditions when deducting/incrementing SP.
-- Mirrors the pattern of deduct_fancoins (00051) and increment_fancoins (00010).

-- deduct_sweat_points: Atomically deducts SP with a WHERE guard to prevent double-spend.
-- Returns the new balance on success, raises EXCEPTION on insufficient funds.
CREATE OR REPLACE FUNCTION deduct_sweat_points(u_id UUID, amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE public.users
  SET sweat_points = sweat_points - amount
  WHERE id = u_id AND sweat_points >= amount
  RETURNING sweat_points INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient Sweat Points or user not found';
  END IF;

  RETURN new_balance;
END;
$$;

-- increment_sweat_points: Atomically adds SP to a user's balance.
CREATE OR REPLACE FUNCTION increment_sweat_points(u_id UUID, amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE public.users
  SET sweat_points = sweat_points + amount
  WHERE id = u_id
  RETURNING sweat_points INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN new_balance;
END;
$$;
