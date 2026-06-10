/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sql = `
    TRUNCATE TABLE league_matches CASCADE;
    TRUNCATE TABLE league_standings CASCADE;
    TRUNCATE TABLE league_instances CASCADE;
    TRUNCATE TABLE players CASCADE;
    TRUNCATE TABLE teams CASCADE;
    UPDATE users SET balance_fancoins = 0, balance_ton = 0, manager_level = 1 WHERE id IS NOT NULL;
  `;
  const { data, error } = await supabase.rpc('execute_sql', { sql });
  console.log('Wipe result:', error ? error.message : 'Success');
}
run();
