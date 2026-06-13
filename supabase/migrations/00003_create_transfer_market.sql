-- 00003_create_transfer_market.sql

CREATE TABLE IF NOT EXISTS public.transfer_market (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    price_ton NUMERIC(10, 4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to ensure a player can only have one active listing at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_player_listing 
ON public.transfer_market (player_id) 
WHERE is_active = true;

-- Optional: RLS statements
-- ALTER TABLE public.transfer_market ENABLE ROW LEVEL SECURITY;
