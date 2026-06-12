-- 00102_social_hub.sql
-- Social Hub: personal_notifications table and RLS policies

CREATE TABLE IF NOT EXISTS public.personal_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('transfer', 'injury', 'challenge', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_notifications_user_created
    ON public.personal_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_notifications_user_unread
    ON public.personal_notifications (user_id, is_read)
    WHERE is_read = false;

-- RLS: users can only read their own notifications
ALTER TABLE public.personal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
    ON public.personal_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System inserts notifications"
    ON public.personal_notifications
    FOR INSERT
    WITH CHECK (true);
