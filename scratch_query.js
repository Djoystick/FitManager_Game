/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('buy_player_from_market', { p_buyer_id: '...', p_listing_id: '...' });
  console.log(data, error);
}

// But wait, we can just do a normal query using npx supabase db query --linked
