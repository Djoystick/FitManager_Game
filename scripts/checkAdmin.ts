import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: team, error } = await supabase.from('teams').select('user_id').eq('name', 'FC10').single();
  if (error || !team) {
    console.error('Error fetching team:', error);
    process.exit(1);
  }

  const { data: user, error: userError } = await supabase.from('users').select('telegram_id, id').eq('id', team.user_id).single();
  if (userError || !user) {
    console.error('Error fetching user:', userError);
    process.exit(1);
  }

  console.log('User UUID:', user.id);
  console.log('User TG ID from DB:', user.telegram_id, typeof user.telegram_id);
  
  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = user.telegram_id ? String(user.telegram_id).trim() : '';
  const isAdmin = adminIdsArray.includes(currentUserIdStr);
  
  console.log('Admin array:', adminIdsArray);
  console.log('currentUserIdStr:', currentUserIdStr);
  console.log('Is Admin?:', isAdmin);

  process.exit(0);
}
run();
