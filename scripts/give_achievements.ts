import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const achievements = [
  'WELCOME', 'WALLET_LINK', 'FACE_REVEAL', 'FIRST_MATCH', 'FIRST_WIN', 'TEN_WINS', 'CENTURY_WINS', 'STREAK_3', 'CLEAN_SHEET', 'GOAL_FEST', 'STADIUM_LVL_2', 'STADIUM_LVL_5', 'ACADEMY_LVL_5', 'TRAINING_LVL_5', 'FULL_HOUSE', 'FIRST_BUY', 'FIRST_SELL', 'MARKET_GURU', 'TRAINING_DAY', 'OVR_75', 'OVR_85', 'PROMOTION', 'LEAGUE_CHAMP', 'TOP_LEAGUE', 'LUCKY_NUMBER'
];

async function run() {
  const { data: team, error: tErr } = await supabase.from('teams').select('id, user_id').eq('name', 'FC10').single();
  if (tErr || !team) {
    console.log('Team FC10 not found', tErr);
    return;
  }
  console.log('Team ID:', team.id, 'User ID:', team.user_id);

  // 1. Give achievements
  const achInserts = achievements.map(code => ({ team_id: team.id, achievement_code: code }));
  const { error: achErr } = await supabase.from('team_achievements').upsert(achInserts, { onConflict: 'team_id, achievement_code' });
  if (achErr) console.log('Ach err:', achErr);
  else console.log('Achievements given');

  // 2. Give trophies
  const trophyInserts = [
    { user_id: team.user_id, type: 'CUP_GOLD', description: 'Чемпион 1-й Лиги' },
    { user_id: team.user_id, type: 'CUP_GOLD', description: 'Кубок Странников' },
    { user_id: team.user_id, type: 'CUP_SILVER', description: 'Финалист Летнего Кубка' },
    { user_id: team.user_id, type: 'ACHIEVEMENT', description: 'Легенда Клуба' }
  ];
  const { error: trErr } = await supabase.from('trophy_cabinet').insert(trophyInserts);
  if (trErr) console.log('Trophy err:', trErr);
  else console.log('Trophies given');

  // 3. Alter players OVR
  const { data: players } = await supabase.from('players').select('id').eq('team_id', team.id);
  if (players && players.length > 0) {
    const targetOvrs = [55, 62, 68, 72, 78, 83, 86, 89, 91, 95, 99];
    
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const newOvr = targetOvrs[i % targetOvrs.length];
      await supabase.from('players').update({ overall_rating: newOvr }).eq('id', p.id);
    }
    console.log(`Players updated with varying OVRs (total: ${players.length})`);
  }

  console.log('Done!');
}
run();
