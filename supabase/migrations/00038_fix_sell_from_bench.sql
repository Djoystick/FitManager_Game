CREATE OR REPLACE FUNCTION public.list_player_on_market(p_seller_id uuid, p_player_id uuid, p_price_ton numeric) RETURNS jsonb AS $$
DECLARE
    v_player_row RECORD;
    v_team_id UUID;
    v_infra_row RECORD;
    v_user_row RECORD;
    v_listing_fee_fc INT;
    v_listing_id UUID;
BEGIN
    IF p_price_ton <= 0 THEN
        RAISE EXCEPTION 'Price must be greater than 0';
    END IF;

    SELECT * INTO v_player_row FROM public.players WHERE id = p_player_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;

    SELECT id INTO v_team_id FROM public.teams WHERE user_id = p_seller_id;
    IF v_player_row.team_id <> v_team_id THEN RAISE EXCEPTION 'Player does not belong to you'; END IF;

    IF v_player_row.lineup_status = 'starting' THEN
        RAISE EXCEPTION 'Уберите игрока из стартового состава перед продажей';
    END IF;

    IF v_player_row.is_retired THEN RAISE EXCEPTION 'Retired players cannot be sold'; END IF;
    IF v_player_row.is_for_sale THEN RAISE EXCEPTION 'Player is already listed for sale'; END IF;

    SELECT * INTO v_infra_row FROM public.infrastructure WHERE team_id = v_team_id;
    v_listing_fee_fc := COALESCE(v_infra_row.stadium_level, 1) * 250;

    SELECT * INTO v_user_row FROM public.users WHERE id = p_seller_id FOR UPDATE;
    IF v_user_row.balance_fancoins < v_listing_fee_fc THEN
        RAISE EXCEPTION 'Insufficient FanCoins for listing fee. Required: %', v_listing_fee_fc;
    END IF;

    UPDATE public.users SET balance_fancoins = balance_fancoins - v_listing_fee_fc WHERE id = p_seller_id;
    UPDATE public.players SET is_for_sale = TRUE WHERE id = p_player_id;

    INSERT INTO public.market_listings (seller_id, player_id, price_ton, status)
    VALUES (p_seller_id, p_player_id, p_price_ton, 'active')
    RETURNING id INTO v_listing_id;

    RETURN jsonb_build_object('success', true, 'listing_id', v_listing_id, 'fee_fc', v_listing_fee_fc);
END;
$$ LANGUAGE plpgsql;
