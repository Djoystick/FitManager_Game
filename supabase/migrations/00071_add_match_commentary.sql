-- Migration 00071: Add match_commentary table for AI-generated broadcast summaries

CREATE TABLE IF NOT EXISTS match_commentary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  commentary_text TEXT NOT NULL,
  highlights JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id)
);

-- Index for fast lookups by match_id
CREATE INDEX IF NOT EXISTS idx_match_commentary_match ON match_commentary(match_id);

-- Grant access
GRANT SELECT ON match_commentary TO anon;
GRANT INSERT ON match_commentary TO service_role;
