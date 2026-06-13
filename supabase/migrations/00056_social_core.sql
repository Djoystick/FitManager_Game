-- 00104_social_core.sql
-- Social PvP: friendships and challenges tables with RLS

-- ============================================================
-- 1. FRIENDSHIPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_friendship UNIQUE (user_a_id, user_b_id),
    CONSTRAINT different_users CHECK (user_a_id <> user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON public.friendships (user_a_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON public.friendships (user_b_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships (status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. PVP CHALLENGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pvp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
    match_id UUID REFERENCES public.league_matches(id) ON DELETE SET NULL,
    result_score TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT different_users CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_pvp_challenges_challenger ON public.pvp_challenges (challenger_id);
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_opponent ON public.pvp_challenges (opponent_id);
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_status ON public.pvp_challenges (status);
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_expires ON public.pvp_challenges (expires_at) WHERE status = 'pending';

ALTER TABLE public.pvp_challenges ENABLE ROW LEVEL SECURITY;
