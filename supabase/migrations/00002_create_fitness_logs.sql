-- 00002_create_fitness_logs.sql

-- Add balance_tp to users table to hold Training Points
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS balance_tp INTEGER DEFAULT 0;

-- Create fitness_logs table
CREATE TABLE IF NOT EXISTS public.fitness_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    calories INTEGER DEFAULT 0,
    earned_tp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: RLS statements
-- ALTER TABLE public.fitness_logs ENABLE ROW LEVEL SECURITY;
