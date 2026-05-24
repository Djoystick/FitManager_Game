-- 00009_increment_rpc.sql

CREATE OR REPLACE FUNCTION increment_fancoins(u_id UUID, amount INT) RETURNS void AS $$ 
BEGIN 
  UPDATE public.users 
  SET balance_fancoins = balance_fancoins + amount 
  WHERE id = u_id; 
END; 
$$ LANGUAGE plpgsql;
