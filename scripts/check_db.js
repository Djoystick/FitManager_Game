import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  console.log('--- LEAGUE INSTANCES ---');
  const { data: instances } = await supabaseAdmin.from('league_instances').select('id, name, status, start_time');
  console.log(instances);

  console.log('\n--- MATCHES STATUS COUNT ---');
  const { data: matches } = await supabaseAdmin.from('league_matches').select('status, round_number');
  
  const counts = matches.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  console.log('Match Status counts:', counts);

  const pendingMatches = matches.filter(m => m.status === 'pending');
  if (pendingMatches.length > 0) {
    console.log(`Lowest pending round: ${Math.min(...pendingMatches.map(m => m.round_number))}`);
  }

}

checkStatus();
