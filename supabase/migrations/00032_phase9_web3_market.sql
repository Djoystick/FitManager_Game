-- 00032_phase9_web3_market.sql
BEGIN;

-- 1. Extend Users table for TON Web3 integration
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS balance_ton NUMERIC(18,9) NOT NULL DEFAULT 0.00;

-- 2. Extend Players table for Market & Aging system
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS age INT NOT NULL DEFAULT 18,
ADD COLUMN IF NOT EXISTS seasons_played INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_retired BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create Treasury Table
CREATE TABLE IF NOT EXISTS public.treasury (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    prize_pool_ton NUMERIC(18,9) NOT NULL DEFAULT 0.00,
    maintenance_ton NUMERIC(18,9) NOT NULL DEFAULT 0.00
);

-- Insert default row if not exists
INSERT INTO public.treasury (id, prize_pool_ton, maintenance_ton)
VALUES (1, 0.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- 4. Market Listing Status Enum
DO $$ BEGIN
    CREATE TYPE market_listing_status AS ENUM ('active', 'sold', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create Market Listings Table
CREATE TABLE IF NOT EXISTS public.market_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    price_ton NUMERIC(18,9) NOT NULL CHECK (price_ton > 0),
    status market_listing_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying active listings
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON public.market_listings(status);
CREATE INDEX IF NOT EXISTS idx_market_listings_player ON public.market_listings(player_id);

-- 6. RPC: List Player on Market
CREATE OR REPLACE FUNCTION public.list_player_on_market(
    p_seller_id UUID,
    p_player_id UUID,
    p_price_ton NUMERIC(18,9)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_row RECORD;
    v_team_id UUID;
    v_infra_row RECORD;
    v_user_row RECORD;
    v_listing_fee_fc INT;
    v_listing_id UUID;
BEGIN
    -- Validate price
    IF p_price_ton <= 0 THEN
        RAISE EXCEPTION 'Price must be greater than 0';
    END IF;

    -- Lock player row
    SELECT * INTO v_player_row
    FROM public.players
    WHERE id = p_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found';
    END IF;

    -- Verify ownership via team
    SELECT id INTO v_team_id
    FROM public.teams
    WHERE user_id = p_seller_id;

    IF v_player_row.team_id <> v_team_id THEN
        RAISE EXCEPTION 'Player does not belong to you';
    END IF;

    -- Check constraints
    IF v_player_row.is_starter THEN
        RAISE EXCEPTION 'Уберите игрока из стартового состава перед продажей';
    END IF;

    IF v_player_row.is_retired THEN
        RAISE EXCEPTION 'Retired players cannot be sold';
    END IF;

    IF v_player_row.is_for_sale THEN
        RAISE EXCEPTION 'Player is already listed for sale';
    END IF;

    -- Get Stadium Level
    SELECT * INTO v_infra_row
    FROM public.infrastructure
    WHERE team_id = v_team_id;

    v_listing_fee_fc := COALESCE(v_infra_row.stadium_level, 1) * 250;

    -- Lock user and check FanCoins
    SELECT * INTO v_user_row
    FROM public.users
    WHERE id = p_seller_id
    FOR UPDATE;

    IF v_user_row.balance_fancoins < v_listing_fee_fc THEN
        RAISE EXCEPTION 'Insufficient FanCoins for listing fee. Required: %', v_listing_fee_fc;
    END IF;

    -- Deduct FC (Burn)
    UPDATE public.users
    SET balance_fancoins = balance_fancoins - v_listing_fee_fc
    WHERE id = p_seller_id;

    -- Mark player as for sale
    UPDATE public.players
    SET is_for_sale = TRUE
    WHERE id = p_player_id;

    -- Create Listing
    INSERT INTO public.market_listings (seller_id, player_id, price_ton, status)
    VALUES (p_seller_id, p_player_id, p_price_ton)
    RETURNING id INTO v_listing_id;

    RETURN jsonb_build_object(
        'success', true,
        'listing_id', v_listing_id,
        'fee_fc', v_listing_fee_fc
    );
END;
$$;

-- 7. RPC: Buy Player from Market
CREATE OR REPLACE FUNCTION public.buy_player_from_market(
    p_buyer_id UUID,
    p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing_row RECORD;
    v_buyer_row RECORD;
    v_seller_row RECORD;
    v_buyer_team_id UUID;
    v_seller_share NUMERIC(18,9);
    v_prize_pool_share NUMERIC(18,9);
    v_maintenance_share NUMERIC(18,9);
BEGIN
    -- Lock listing
    SELECT * INTO v_listing_row
    FROM public.market_listings
    WHERE id = p_listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found';
    END IF;

    IF v_listing_row.status <> 'active' THEN
        RAISE EXCEPTION 'Listing is no longer active';
    END IF;

    IF v_listing_row.seller_id = p_buyer_id THEN
        RAISE EXCEPTION 'You cannot buy your own player';
    END IF;

    -- Get Buyer Team
    SELECT id INTO v_buyer_team_id
    FROM public.teams
    WHERE user_id = p_buyer_id;

    IF v_buyer_team_id IS NULL THEN
        RAISE EXCEPTION 'Buyer does not have a team';
    END IF;

    -- Lock Buyer
    SELECT * INTO v_buyer_row
    FROM public.users
    WHERE id = p_buyer_id
    FOR UPDATE;

    IF v_buyer_row.balance_ton < v_listing_row.price_ton THEN
        RAISE EXCEPTION 'Insufficient TON balance. Required: %', v_listing_row.price_ton;
    END IF;

    -- Lock Seller
    SELECT * INTO v_seller_row
    FROM public.users
    WHERE id = v_listing_row.seller_id
    FOR UPDATE;

    -- Lock Treasury
    PERFORM * FROM public.treasury WHERE id = 1 FOR UPDATE;

    -- Calculate Splits
    v_seller_share := ROUND(v_listing_row.price_ton * 0.95, 9);
    v_prize_pool_share := ROUND(v_listing_row.price_ton * 0.03, 9);
    v_maintenance_share := v_listing_row.price_ton - v_seller_share - v_prize_pool_share; -- ensures no rounding loss

    -- Process Payments
    UPDATE public.users
    SET balance_ton = balance_ton - v_listing_row.price_ton
    WHERE id = p_buyer_id;

    UPDATE public.users
    SET balance_ton = balance_ton + v_seller_share
    WHERE id = v_listing_row.seller_id;

    UPDATE public.treasury
    SET prize_pool_ton = prize_pool_ton + v_prize_pool_share,
        maintenance_ton = maintenance_ton + v_maintenance_share
    WHERE id = 1;

    -- Transfer Player
    UPDATE public.players
    SET team_id = v_buyer_team_id,
        is_for_sale = FALSE,
        is_starter = FALSE -- ensure it is FALSE on transfer
    WHERE id = v_listing_row.player_id;

    -- Update Listing Status
    UPDATE public.market_listings
    SET status = 'sold'
    WHERE id = p_listing_id;

    RETURN jsonb_build_object(
        'success', true,
        'player_id', v_listing_row.player_id,
        'price_ton', v_listing_row.price_ton
    );
END;
$$;

-- 8. RPC: Cancel Market Listing
CREATE OR REPLACE FUNCTION public.cancel_market_listing(
    p_seller_id UUID,
    p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing_row RECORD;
BEGIN
    -- Lock listing
    SELECT * INTO v_listing_row
    FROM public.market_listings
    WHERE id = p_listing_id AND seller_id = p_seller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found or you are not the seller';
    END IF;

    IF v_listing_row.status <> 'active' THEN
        RAISE EXCEPTION 'Listing is not active';
    END IF;

    -- Update Listing
    UPDATE public.market_listings
    SET status = 'cancelled'
    WHERE id = p_listing_id;

    -- Update Player
    UPDATE public.players
    SET is_for_sale = FALSE
    WHERE id = v_listing_row.player_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
