import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  console.log("Checking filling instances...");
  const { data: instances } = await supabase.from('league_instances').select('*').eq('status', 'filling');
  console.log("Instances:", instances);

  for (const inst of instances || []) {
    const { data: standings } = await supabase.from('league_standings').select('team_id').eq('league_instance_id', inst.id);
    console.log(`Instance ${inst.id} has ${standings?.length} teams`);
  }
}

check();
