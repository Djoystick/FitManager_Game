-- 00007_add_stamina_and_bench.sql

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS stamina INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS lineup_status VARCHAR(20) DEFAULT 'starting';
