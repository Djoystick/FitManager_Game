ALTER TABLE players ADD COLUMN morale INTEGER DEFAULT 70 CHECK (morale >= 0 AND morale <= 100);

CREATE TABLE youth_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    position TEXT NOT NULL,
    ovr INTEGER NOT NULL,
    potential_limit INTEGER NOT NULL,
    stats JSONB NOT NULL,
    traits JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
