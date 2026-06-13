-- ==============================================================================
-- Migration: 00073_secure_remaining_tables.sql
-- Purpose: Enable Row Level Security (RLS) on the remaining exposed tables
--          to prevent unauthorized inserts/updates/deletes from the frontend client.
-- ==============================================================================

-- 1. staff
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select" ON public.staff;
CREATE POLICY "staff_select" ON public.staff 
    FOR SELECT USING (true);

-- 2. tournament_matches
ALTER TABLE IF EXISTS public.tournament_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournament_matches_select" ON public.tournament_matches;
CREATE POLICY "tournament_matches_select" ON public.tournament_matches 
    FOR SELECT USING (true);

-- 3. tournament_participants
ALTER TABLE IF EXISTS public.tournament_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournament_participants_select" ON public.tournament_participants;
CREATE POLICY "tournament_participants_select" ON public.tournament_participants 
    FOR SELECT USING (true);

-- 4. tournaments
ALTER TABLE IF EXISTS public.tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_select" ON public.tournaments;
CREATE POLICY "tournaments_select" ON public.tournaments 
    FOR SELECT USING (true);

-- 5. training_sessions
ALTER TABLE IF EXISTS public.training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_sessions_select" ON public.training_sessions;
CREATE POLICY "training_sessions_select" ON public.training_sessions 
    FOR SELECT USING (true);

-- 6. treasury
ALTER TABLE IF EXISTS public.treasury ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treasury_select" ON public.treasury;
CREATE POLICY "treasury_select" ON public.treasury 
    FOR SELECT USING (true);

-- 7. treasury_transactions
ALTER TABLE IF EXISTS public.treasury_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treasury_transactions_select" ON public.treasury_transactions;
CREATE POLICY "treasury_transactions_select" ON public.treasury_transactions 
    FOR SELECT USING (true);

-- 8. trophy_cabinet
ALTER TABLE IF EXISTS public.trophy_cabinet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trophy_cabinet_select" ON public.trophy_cabinet;
CREATE POLICY "trophy_cabinet_select" ON public.trophy_cabinet 
    FOR SELECT USING (true);

-- 9. youth_intakes
ALTER TABLE IF EXISTS public.youth_intakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "youth_intakes_select" ON public.youth_intakes;
CREATE POLICY "youth_intakes_select" ON public.youth_intakes 
    FOR SELECT USING (true);
