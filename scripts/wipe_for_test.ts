import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function wipe() {
  console.log("Wiping all game data for a clean test...");
  
  // Tables with cascades: deleting teams deletes players and standings. Deleting instances deletes standings and matches.
  await supabase.from('teams').delete().neq('name', 'Free Agents Pool').neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('league_instances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().like('telegram_id', 'bot_%');
  
  console.log("Wipe complete!");
}

wipe();
