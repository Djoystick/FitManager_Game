-- 00004_achievements_system.sql

-- 1. Modify users table to hold TON balance if not exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance_ton NUMERIC(10, 4) DEFAULT 0;

-- 2. Modify teams table to track stats
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::JSONB;

-- 3. Create team_achievements table
CREATE TABLE IF NOT EXISTS public.team_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    achievement_code VARCHAR(255) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_team_achievement UNIQUE(team_id, achievement_code)
);

-- 4. Create notifications table for offline toasts
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
ALTER TABLE public.team_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Note: In a real app we would add specific RLS policies here. 
-- For now we rely on the service_role key to manage achievements/notifications in backend.
