-- 00041_deduct_training_coins.sql

CREATE OR REPLACE FUNCTION deduct_training_coins(
  u_id UUID,
  c_cost INT,
  f_cost INT,
  b_cost INT,
  s_cost INT
)
RETURNS boolean AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.users
  SET 
    cardio_coin = cardio_coin - c_cost,
    fitness_coin = fitness_coin - f_cost,
    ball_coin = ball_coin - b_cost,
    strength_coin = strength_coin - s_cost
  WHERE id = u_id
    AND cardio_coin >= c_cost
    AND fitness_coin >= f_cost
    AND ball_coin >= b_cost
    AND strength_coin >= s_cost
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION deduct_training_coins(UUID, INT, INT, INT, INT) TO service_role;
