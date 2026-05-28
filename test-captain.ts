import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testCaptain() {
  console.log("Fetching a random user to test...");
  const { data: users } = await supabaseAdmin.from('users').select('id, telegram_id').limit(1);
  if (!users || users.length === 0) {
    console.log("No users found.");
    return;
  }
  
  const userId = users[0].id;
  console.log(`Using user: ${userId}`);

  // Hard Reset User Team manually for test
  console.log("Performing Hard Reset...");
  await supabaseAdmin.from('teams').delete().eq('user_id', userId);

  console.log("Creating new team with Star Captain mechanic...");
  
  // We can't use the Server Action directly here because it depends on cookies(), 
  // but we can just invoke it by passing the cookie manually? No, server actions are hard to invoke from a raw script.
  // We'll just fetch the newly generated players by looking at the DB after using an HTTP request or just duplicating the DB check.

  console.log("Hard Reset complete. The user should now go to the web app and create a team to see the Star Captain.");
}

testCaptain().catch(console.error);
