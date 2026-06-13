import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sql = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS morale INTEGER DEFAULT 70 CHECK (morale >= 0 AND morale <= 100);

CREATE TABLE IF NOT EXISTS youth_intakes (
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
  `;
  const { error } = await supabaseAdmin.rpc('execute_sql', { sql: sql });
  if (error) {
    console.error('Migration error:', error);
  } else {
    console.log('Migration applied successfully.');
  }
}

main();
