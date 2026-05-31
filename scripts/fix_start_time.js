import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStartTime() {
  const { data, error } = await supabaseAdmin
    .from('league_instances')
    .update({ start_time: new Date().toISOString() })
    .eq('status', 'active');
  console.log('Fixed start time for active leagues.');
}

fixStartTime();
