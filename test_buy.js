/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('buy_player_from_market', { 
    p_buyer_id: 'eab70b8c-5a9e-4e4f-b648-5c4d058a9cc3', // Djoystick user
    p_listing_id: '1b26df4e-8b60-4de7-b7ac-bbe751718b60' // Price 4.58
  });
  console.log('Result:', data, error);
}

run();
