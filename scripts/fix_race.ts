import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fixRace() {
  const instance1 = 'a62c29bd-f54e-4779-850e-71e446ff03d9'; // Sector 561
  const instance2 = '63c1f2b3-3feb-46ad-baa4-6696578b2805'; // Sector 106

  // Find team in Sector 106
  const { data: standings } = await supabase.from('league_standings').select('team_id').eq('league_instance_id', instance2);
  const teamIdToMove = standings![0].team_id;

  console.log("Moving team", teamIdToMove, "to", instance1);

  // Move them
  await supabase.from('league_standings').update({ league_instance_id: instance1 }).eq('team_id', teamIdToMove);

  // Delete Sector 106
  await supabase.from('league_instances').delete().eq('id', instance2);

  // Trigger autofill on Sector 561
  const res = await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/cron/league-autofill');
  console.log("Autofill triggered:", await res.text());
}

fixRace();
