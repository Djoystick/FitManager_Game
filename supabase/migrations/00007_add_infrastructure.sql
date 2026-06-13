-- 00006_add_infrastructure.sql

CREATE TABLE IF NOT EXISTS public.infrastructure (
    team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
    stadium_level INTEGER NOT NULL DEFAULT 1,
    training_camp_level INTEGER NOT NULL DEFAULT 1,
    medical_center_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
