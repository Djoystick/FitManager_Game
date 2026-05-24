# Report: TP Healing System & Medical Center

## 1. Atomic Database Healing Transaction (`00015_heal_player_rpc.sql`)
The Medical Center feature introduces a robust currency sink, allowing managers to spend Training Points (TP) earned from the Walk-to-Earn system to instantly revitalize player stamina. To prevent any race conditions where a player might be healed without deducting the TP balance (or vice-versa), an atomic PostgreSQL RPC (`heal_player_with_tp`) was implemented.

### Explicit SQL Transaction Logic:
```sql
CREATE OR REPLACE FUNCTION heal_player_with_tp(p_id UUID, u_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Validation & Strict TP Check
    IF (SELECT balance_tp FROM public.users WHERE id = u_id) < 50 THEN
        RAISE EXCEPTION 'Insufficient Training Points';
    END IF;

    -- 2. Security Check: Prevent arbitrary UUID manipulation
    IF NOT EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.teams t ON p.team_id = t.id
        WHERE p.id = p_id AND t.user_id = u_id
    ) THEN
        RAISE EXCEPTION 'Player does not belong to user';
    END IF;

    -- 3. Deduction (Currency Sink)
    UPDATE public.users
    SET balance_tp = balance_tp - 50
    WHERE id = u_id;

    -- 4. Full Revitalization
    UPDATE public.players
    SET stamina = 100
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
```
Because this entire block executes natively within Postgres, the TP deduction and stamina update are completely atomic. If the server crashes between step 3 and 4, the transaction rolls back, guaranteeing data integrity.

## 2. API Wrapper (`app/api/players/heal/route.ts`)
A secure REST endpoint validates the inputs and invokes the `heal_player_with_tp` RPC. Any Postgres exception is safely caught and bubbled up as a 500 error, preventing backend crashes while logging the malicious or invalid attempt.

## 3. UI Integration & Optimistic Updates
The `PlayerTrainingModal.tsx` was expanded to serve as a comprehensive "Player Hub", acting as both the Training Camp and the Medical Center.

- **Dynamic Visibility:** The "Medical Center" sub-section is completely hidden if the player is already at `stamina = 100`, keeping the UI extremely clean.
- **Visual Mechanics:** An orange stamina gauge visually represents the missing energy. The custom `Heal (50 TP)` button glows in the signature `neon-green`, turning gray and `cursor-not-allowed` if the user's TP balance falls below 50.
- **Global Event Sync:** Upon a successful heal, the modal instantly triggers the `window.dispatchEvent(new Event('balanceUpdated'))` hook. This alerts the `GlobalHeader` to animate and decrement the TP visually, while simultaneously forcing an optimistic React state update to max out the stamina bar without requiring a cumbersome page reload.
