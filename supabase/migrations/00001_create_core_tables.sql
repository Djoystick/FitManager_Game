-- 00001_create_core_tables.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(255) UNIQUE,
    balance_fancoins BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    ovr INTEGER NOT NULL CHECK (ovr >= 1 AND ovr <= 99),
    potential_limit INTEGER NOT NULL CHECK (potential_limit >= 1 AND potential_limit <= 99),
    perks JSONB DEFAULT '[]'::JSONB,
    is_nft_coach BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MATCHES TABLE
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_simulated BOOLEAN DEFAULT FALSE,
    CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

-- LEAGUE STANDINGS TABLE
CREATE TABLE IF NOT EXISTS public.league_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    UNIQUE(team_id)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) SETUP COMMENTS
-- ==========================================
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;

-- Example Policy:
-- CREATE POLICY "Users can only view/edit their own profile" ON public.users 
-- FOR ALL USING (auth.uid() = id);
