-- SQL Migration for Bug Report & Logging System

-- 1. Create system_logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    admin_notes TEXT
);

-- Protect system logs (optional: if you want RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all users" ON public.system_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read for service role only" ON public.system_logs FOR SELECT USING (true); -- Usually restricted, but service_role bypasses RLS anyway

-- 2. Create bug_reports table
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    admin_notes TEXT
);

-- Protect bug_reports
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all users" ON public.bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own reports" ON public.bug_reports FOR SELECT USING (auth.uid() = user_id);
-- Service role handles admin reads

-- Add admin_notes to both tables in case they already exist
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_logs' AND column_name='admin_notes') THEN
--     ALTER TABLE public.system_logs ADD COLUMN admin_notes TEXT;
--   END IF;
--   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bug_reports' AND column_name='admin_notes') THEN
--     ALTER TABLE public.bug_reports ADD COLUMN admin_notes TEXT;
--   END IF;
-- END $$;
