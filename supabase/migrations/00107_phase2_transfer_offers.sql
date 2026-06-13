-- Migration 00107: Transfer Offers
CREATE TABLE IF NOT EXISTS public.transfer_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    receiver_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    target_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    offered_fc INTEGER NOT NULL DEFAULT 0,
    offered_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.transfer_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read offers related to their team"
ON public.transfer_offers
FOR SELECT
USING (
    sender_team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()) OR
    receiver_team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid())
);

-- Allow insertions by sender
CREATE POLICY "Users can insert offers as sender"
ON public.transfer_offers
FOR INSERT
WITH CHECK (
    sender_team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid())
);

-- Add notification for incoming offers
-- Wait, notifications are added via backend code, no need for trigger here unless necessary.
