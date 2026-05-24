-- 00021_create_league_matches.sql

CREATE TABLE IF NOT EXISTS public.league_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL,
    home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    is_played BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

-- Note: We do NOT enable RLS on this table because we rely on supabaseAdmin
-- for generation and match simulation. If we needed client-side access,
-- we could enable it and add a policy for SELECT.
