import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE public.league_standings ADD COLUMN IF NOT EXISTS goals_for INTEGER DEFAULT 0;
      ALTER TABLE public.league_standings ADD COLUMN IF NOT EXISTS goals_against INTEGER DEFAULT 0;
    `
  });

  // If RPC is not defined, we'll just try to insert a dummy and ignore if it fails, or it might not work.
  if (error) {
    console.error("RPC failed, trying fallback...", error);
    // Since we don't have direct SQL execution, we can't reliably alter table via supabase-js without an RPC.
    console.log("Please ensure the migration is applied via Supabase Dashboard or CLI.");
  } else {
    console.log("Migration applied successfully!");
  }
}

applyMigration();
