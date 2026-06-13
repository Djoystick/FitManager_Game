import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function wipeDatabase() {
  console.log('🧹 Starting Full Database Wipe...');

  // Delete Treasury
  await supabaseAdmin.from('treasury').delete().neq('tier_level', 0);
  console.log('✅ treasury wiped successfully.');

  // Delete Infrastructure
  await supabaseAdmin.from('infrastructure').delete().neq('team_id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ infrastructure wiped successfully.');

  const tablesToWipe = [
    'league_matches',
    'league_standings',
    'league_instances',
    'transfer_market',
    'players',
    'teams',
    'users'
  ];

  for (const table of tablesToWipe) {
    try {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      if (error) {
        console.error(`  ❌ Error wiping ${table}:`, error.message);
      } else {
        console.log(`✅ ${table} wiped successfully.`);
      }
    } catch (err) {
      console.error(`  ❌ Exception wiping ${table}:`, err.message);
    }
  }

  // Recreate Treasury tiers
  console.log('🏦 Recreating Treasury initial tiers...');
  for (let i = 1; i <= 10; i++) {
    await supabaseAdmin.from('treasury').insert({
      tier_level: i,
      prize_pool_ton: 0
    });
  }
  console.log('✅ Treasury initialized.');

  console.log('✨ Database Wipe Complete! You can now create a fresh team.');
}

wipeDatabase();
