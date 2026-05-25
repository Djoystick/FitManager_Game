import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/00023_add_lineup_slots.sql', 'utf8');
  const { data, error } = await supabase.rpc('execute_sql', { sql });

  if (error) {
    console.error("RPC failed...", error);
  } else {
    console.log("Migration applied successfully!");
  }
}

applyMigration();
