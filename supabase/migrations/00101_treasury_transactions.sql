-- 00101_treasury_transactions.sql
-- Creates a transaction log for all currency movements, enabling the AI Economy Agent
-- to operate on real financial data instead of Math.random() stubs.

CREATE TABLE IF NOT EXISTS public.treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    currency TEXT NOT NULL CHECK (currency IN ('TON', 'FC', 'SP')),
    amount NUMERIC(20,9) NOT NULL,
    reason TEXT NOT NULL DEFAULT 'Trigger Update',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_currency_created
    ON public.treasury_transactions (currency, created_at);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_user
    ON public.treasury_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_team
    ON public.treasury_transactions (team_id);

-- ============================================================
-- Trigger: log TON balance changes on the users table
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_balance_ton_change()
RETURNS TRIGGER AS $$
DECLARE
    v_delta NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.balance_ton IS NOT NULL AND NEW.balance_ton <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (NEW.id, 'TON', NEW.balance_ton, 'Balance Trigger (TON) - Initial');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_delta := NEW.balance_ton - OLD.balance_ton;
        IF v_delta <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (NEW.id, 'TON', v_delta, 'Balance Trigger (TON)');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.balance_ton IS NOT NULL AND OLD.balance_ton <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (OLD.id, 'TON', -OLD.balance_ton, 'Balance Trigger (TON) - Removed');
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_balance_ton ON public.users;
CREATE TRIGGER trg_log_balance_ton
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.log_balance_ton_change();

-- ============================================================
-- Trigger: log FC balance changes on the users table
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_balance_fc_change()
RETURNS TRIGGER AS $$
DECLARE
    v_delta NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.balance_fancoins IS NOT NULL AND NEW.balance_fancoins <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (NEW.id, 'FC', NEW.balance_fancoins, 'Balance Trigger (FC) - Initial');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_delta := NEW.balance_fancoins - OLD.balance_fancoins;
        IF v_delta <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (NEW.id, 'FC', v_delta, 'Balance Trigger (FC)');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.balance_fancoins IS NOT NULL AND OLD.balance_fancoins <> 0 THEN
            INSERT INTO public.treasury_transactions (user_id, currency, amount, reason)
            VALUES (OLD.id, 'FC', -OLD.balance_fancoins, 'Balance Trigger (FC) - Removed');
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_balance_fc ON public.users;
CREATE TRIGGER trg_log_balance_fc
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.log_balance_fc_change();

-- ============================================================
-- Trigger: log SP balance changes on the teams table
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_balance_sp_change()
RETURNS TRIGGER AS $$
DECLARE
    v_delta NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.sweat_points IS NOT NULL AND NEW.sweat_points <> 0 THEN
            INSERT INTO public.treasury_transactions (team_id, currency, amount, reason)
            VALUES (NEW.id, 'SP', NEW.sweat_points, 'Balance Trigger (SP) - Initial');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_delta := NEW.sweat_points - OLD.sweat_points;
        IF v_delta <> 0 THEN
            INSERT INTO public.treasury_transactions (team_id, currency, amount, reason)
            VALUES (NEW.id, 'SP', v_delta, 'Balance Trigger (SP)');
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.sweat_points IS NOT NULL AND OLD.sweat_points <> 0 THEN
            INSERT INTO public.treasury_transactions (team_id, currency, amount, reason)
            VALUES (OLD.id, 'SP', -OLD.sweat_points, 'Balance Trigger (SP) - Removed');
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_balance_sp ON public.teams;
CREATE TRIGGER trg_log_balance_sp
    AFTER INSERT OR UPDATE OR DELETE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.log_balance_sp_change();
