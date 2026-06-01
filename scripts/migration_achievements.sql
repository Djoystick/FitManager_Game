-- SQL Migration for Achievements System

-- 1. Create user_achievements table
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    achievement_code TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reward_claimed BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, achievement_code)
);

-- Protect user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
-- Inserts and Updates are handled by the service role only

-- 2. Create achievement_global_stats table (Cache)
CREATE TABLE IF NOT EXISTS public.achievement_global_stats (
    achievement_code TEXT PRIMARY KEY,
    total_unlocked INT DEFAULT 0,
    percentage FLOAT DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Protect achievement_global_stats
ALTER TABLE public.achievement_global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view global stats" ON public.achievement_global_stats FOR SELECT USING (true);
-- Updates are handled by the service role (cron job)

-- Helper function to recalculate stats quickly
CREATE OR REPLACE FUNCTION update_achievement_stats()
RETURNS void AS $$
DECLARE
    total_users INT;
BEGIN
    SELECT COUNT(*) INTO total_users FROM public.users;
    
    IF total_users = 0 THEN
        RETURN;
    END IF;

    -- Clear old stats
    DELETE FROM public.achievement_global_stats;

    -- Insert new stats
    INSERT INTO public.achievement_global_stats (achievement_code, total_unlocked, percentage)
    SELECT 
        achievement_code, 
        COUNT(*), 
        (COUNT(*)::FLOAT / total_users) * 100
    FROM public.user_achievements
    GROUP BY achievement_code;
    
END;
$$ LANGUAGE plpgsql;
