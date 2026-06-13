import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sql = fs.readFileSync('supabase/migrations/00106_phase2_daily_quests.sql', 'utf-8');
  const { error } = await supabaseAdmin.rpc('execute_sql', { sql: sql });
  if (error) {
    console.error('Migration error:', error);
  } else {
    console.log('Migration applied successfully.');
  }
}

main();
