BEGIN;

CREATE TABLE IF NOT EXISTS public.player_chemistry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    player_1_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_2_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    matches_together INTEGER DEFAULT 0 NOT NULL,
    sweat_points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_1_id, player_2_id)
);

ALTER TABLE public.player_chemistry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team chemistry" 
    ON public.player_chemistry 
    FOR SELECT 
    USING (
        team_id IN (
            SELECT id FROM public.teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their team chemistry" 
    ON public.player_chemistry 
    FOR ALL
    USING (
        team_id IN (
            SELECT id FROM public.teams WHERE user_id = auth.uid()
        )
    );

COMMIT;
