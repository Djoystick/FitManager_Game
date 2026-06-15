-- 00079: Atomic accept_transfer_offer RPC
-- Moves the entire transfer acceptance logic into a single SQL transaction.
-- Prevents race conditions where FC could be deducted but player not moved
-- (or vice versa) if the server crashes mid-operation.

CREATE OR REPLACE FUNCTION accept_transfer_offer(
  p_offer_id UUID,
  p_receiver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer          RECORD;
  v_receiver_team  RECORD;
  v_sender_team    RECORD;
  v_sender_user    RECORD;
  v_target_player  RECORD;
  v_offered_player RECORD;
  v_new_sender_balance NUMERIC;
BEGIN
  -- 1. Lock the offer row to prevent concurrent accept attempts
  SELECT * INTO v_offer
  FROM public.transfer_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF v_offer.status != 'pending' THEN
    RAISE EXCEPTION 'Offer is not pending (status: %)', v_offer.status;
  END IF;

  -- 2. Verify receiver owns the receiver_team
  SELECT id INTO v_receiver_team
  FROM public.teams
  WHERE user_id = p_receiver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiver team not found';
  END IF;

  IF v_offer.receiver_team_id != v_receiver_team.id THEN
    RAISE EXCEPTION 'Unauthorized to accept this offer';
  END IF;

  -- 3. Verify sender team exists
  SELECT id, user_id INTO v_sender_team
  FROM public.teams
  WHERE id = v_offer.sender_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender team not found';
  END IF;

  -- 4. Verify sender has enough FC
  SELECT id, balance_fancoins INTO v_sender_user
  FROM public.users
  WHERE id = v_sender_team.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender user not found';
  END IF;

  IF v_sender_user.balance_fancoins < v_offer.offered_fc THEN
    RAISE EXCEPTION 'Sender does not have enough FanCoins (has %, needs %)',
      v_sender_user.balance_fancoins, v_offer.offered_fc;
  END IF;

  -- 5. Verify target player is still in receiver's team
  SELECT id, team_id INTO v_target_player
  FROM public.players
  WHERE id = v_offer.target_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target player not found';
  END IF;

  IF v_target_player.team_id != v_receiver_team.id THEN
    RAISE EXCEPTION 'Target player is no longer in your team';
  END IF;

  -- 6. Verify offered player (if any) is still in sender's team
  IF v_offer.offered_player_id IS NOT NULL THEN
    SELECT id, team_id INTO v_offered_player
    FROM public.players
    WHERE id = v_offer.offered_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Offered player not found';
    END IF;

    IF v_offered_player.team_id != v_offer.sender_team_id THEN
      RAISE EXCEPTION 'Offered player is no longer in sender team';
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- ALL CHECKS PASSED — execute the transfer atomically
  -- ═══════════════════════════════════════════════════════════════════

  -- 7. Deduct FC from sender (atomic with WHERE guard)
  IF v_offer.offered_fc > 0 THEN
    UPDATE public.users
    SET balance_fancoins = balance_fancoins - v_offer.offered_fc
    WHERE id = v_sender_team.user_id
      AND balance_fancoins >= v_offer.offered_fc
    RETURNING balance_fancoins INTO v_new_sender_balance;

    IF v_new_sender_balance IS NULL THEN
      RAISE EXCEPTION 'Failed to deduct FanCoins (insufficient balance or race condition)';
    END IF;

    -- Add FC to receiver
    UPDATE public.users
    SET balance_fancoins = balance_fancoins + v_offer.offered_fc
    WHERE id = p_receiver_id;
  END IF;

  -- 8. Transfer target_player to sender's team
  UPDATE public.players
  SET team_id = v_offer.sender_team_id,
      lineup_status = 'bench',
      lineup_slot = NULL
  WHERE id = v_offer.target_player_id;

  -- 9. Transfer offered_player to receiver's team (if swap)
  IF v_offer.offered_player_id IS NOT NULL THEN
    UPDATE public.players
    SET team_id = v_receiver_team.id,
        lineup_status = 'bench',
        lineup_slot = NULL
    WHERE id = v_offer.offered_player_id;
  END IF;

  -- 10. Mark this offer as accepted
  UPDATE public.transfer_offers
  SET status = 'accepted'
  WHERE id = p_offer_id;

  -- 11. Reject other pending offers for the target player
  UPDATE public.transfer_offers
  SET status = 'rejected'
  WHERE target_player_id = v_offer.target_player_id
    AND status = 'pending'
    AND id != p_offer_id;

  -- 12. Reject other pending offers involving the offered player (if swap)
  IF v_offer.offered_player_id IS NOT NULL THEN
    UPDATE public.transfer_offers
    SET status = 'rejected'
    WHERE (target_player_id = v_offer.offered_player_id
           OR offered_player_id = v_offer.offered_player_id)
      AND status = 'pending'
      AND id != p_offer_id;
  END IF;

  -- Return success with new sender balance for UI update
  RETURN jsonb_build_object(
    'success', true,
    'new_sender_balance', COALESCE(v_new_sender_balance, v_sender_user.balance_fancoins)
  );
END;
$$;
