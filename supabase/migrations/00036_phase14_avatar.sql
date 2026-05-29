-- 00036_phase14_avatar.sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024);
