-- 00033_fix_market_is_starter.sql
BEGIN;

-- Update list_player_on_market to use lineup_status instead of is_starter
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

    -- Check constraints (use lineup_status instead of is_starter)
    IF v_player_row.lineup_status = 'starting' OR v_player_row.lineup_status = 'bench' THEN
        RAISE EXCEPTION 'Уберите игрока из состава (Starting/Bench) перед продажей';
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


-- Update buy_player_from_market to use lineup_status instead of is_starter
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
        lineup_status = 'reserve',
        lineup_slot = NULL
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

COMMIT;
