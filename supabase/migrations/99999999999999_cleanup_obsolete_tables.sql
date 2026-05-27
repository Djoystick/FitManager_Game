-- 99999999999999_cleanup_obsolete_tables.sql
-- ВНИМАНИЕ: DRY RUN СКРИПТ (ЧЕРНОВИК).
-- НЕ ВЫПОЛНЯТЬ до тех пор, пока из кодовой базы не будут вычищены остаточные вызовы к этим объектам!

BEGIN;

-- 1. Удаление устаревшей таблицы матчей (полностью заменена на league_matches)
DROP TABLE IF EXISTS public.matches CASCADE;

-- 2. Удаление устаревшей View турнирной таблицы (опиралась на старую таблицу matches, 
-- в то время как сейчас мы напрямую обновляем таблицу league_standings через matchActions)
DROP VIEW IF EXISTS public.league_standings_view CASCADE;

COMMIT;
