-- ==============================================================================
-- Migration: 00072_secure_unrestricted_tables.sql
-- Purpose: Enable Row Level Security (RLS) on all exposed tables to prevent
--          unauthorized inserts/updates/deletes from the frontend client.
-- ==============================================================================

-- 1. daily_quests
ALTER TABLE IF EXISTS public.daily_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_quests_select" ON public.daily_quests;
CREATE POLICY "daily_quests_select" ON public.daily_quests 
    FOR SELECT USING (auth.uid() = user_id);

-- 2. fitness_logs
ALTER TABLE IF EXISTS public.fitness_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fitness_logs_select" ON public.fitness_logs;
CREATE POLICY "fitness_logs_select" ON public.fitness_logs 
    FOR SELECT USING (auth.uid() = user_id);

-- 3. league_instances
ALTER TABLE IF EXISTS public.league_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_instances_select" ON public.league_instances;
CREATE POLICY "league_instances_select" ON public.league_instances 
    FOR SELECT USING (true); -- Publicly readable by all players

-- 4. league_tiers
ALTER TABLE IF EXISTS public.league_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_tiers_select" ON public.league_tiers;
CREATE POLICY "league_tiers_select" ON public.league_tiers 
    FOR SELECT USING (true); -- Publicly readable

-- 5. manager_objectives
ALTER TABLE IF EXISTS public.manager_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manager_objectives_select" ON public.manager_objectives;
CREATE POLICY "manager_objectives_select" ON public.manager_objectives 
    FOR SELECT USING (true);

-- 6. manager_rivalries
ALTER TABLE IF EXISTS public.manager_rivalries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manager_rivalries_select" ON public.manager_rivalries;
CREATE POLICY "manager_rivalries_select" ON public.manager_rivalries 
    FOR SELECT USING (true); -- Other managers can see rivalries

-- 7. match_commentary
ALTER TABLE IF EXISTS public.match_commentary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_commentary_select" ON public.match_commentary;
CREATE POLICY "match_commentary_select" ON public.match_commentary 
    FOR SELECT USING (true); -- Match reports are public

-- 8. season_awards
ALTER TABLE IF EXISTS public.season_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "season_awards_select" ON public.season_awards;
CREATE POLICY "season_awards_select" ON public.season_awards 
    FOR SELECT USING (true); -- Awards history is public

-- 9. social_posts
ALTER TABLE IF EXISTS public.social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_posts_select" ON public.social_posts;
CREATE POLICY "social_posts_select" ON public.social_posts 
    FOR SELECT USING (true); -- Social feed is public

-- ==============================================================================
-- Secure Views (Postgres 15+)
-- This forces views to execute using the permissions of the user querying them,
-- rather than the permissions of the view creator, removing the UNRESTRICTED badge.
-- ==============================================================================

DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'fitness_sync_status') THEN
    ALTER VIEW public.fitness_sync_status SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'players_economy_status') THEN
    ALTER VIEW public.players_economy_status SET (security_invoker = true);
  END IF;
END $$;
