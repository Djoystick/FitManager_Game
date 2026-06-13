import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.from('economy_state').select('*').limit(1);
  if (error) {
    console.error('Table does not exist or error:', error.message);
  } else {
    console.log('Table exists. Data:', data);
  }
}

check();
