ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_quests_completed INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS daily_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    quest_type TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    is_claimed BOOLEAN DEFAULT false,
    reward_fc INTEGER NOT NULL,
    reward_sp INTEGER NOT NULL,
    UNIQUE(user_id, date, quest_type)
);

CREATE OR REPLACE FUNCTION increment_quest_progress(p_user_id UUID, p_type TEXT, p_amount INTEGER)
RETURNS void AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    UPDATE daily_quests
    SET current_value = LEAST(current_value + p_amount, target_value)
    WHERE user_id = p_user_id AND date = today AND quest_type = p_type AND is_claimed = false;
END;
$$ LANGUAGE plpgsql;
