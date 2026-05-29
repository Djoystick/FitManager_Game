const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FIRST_NAMES = ['Bot', 'Auto', 'Cyber', 'Neon', 'Meta', 'Holo', 'Quantum', 'Plasma', 'Aura', 'Zenith', 'Echo', 'Nexus', 'Apex'];
const LAST_NAMES = ['Strikers', 'United', 'City', 'FC', 'Athletic', 'Rovers', 'Wanderers', 'Dynamos', 'Titans', 'Legends', 'Force', 'Stars'];

async function run() {
  console.log('Starting seed...');
  const usersToInsert = [];
  for(let i=0; i<13; i++) {
    usersToInsert.push({ id: crypto.randomUUID(), telegram_id: 'bot_' + crypto.randomUUID(), balance_fancoins: 5000 });
  }
  const { data: users } = await supabaseAdmin.from('users').insert(usersToInsert).select('id');
  
  const teamsToInsert = users.map((u, i) => ({ id: crypto.randomUUID(), user_id: u.id, name: FIRST_NAMES[i] + ' ' + LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)] }));
  const { data: teams } = await supabaseAdmin.from('teams').insert(teamsToInsert).select('id');
  
  const players = [];
  const BOT_POSITIONS = [{ pos: 'GK', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' }, { pos: 'GK', status: 'bench' }, { pos: 'DEF', status: 'bench' }, { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' }, { pos: 'FWD', status: 'bench' }];
  
  for(const team of teams) {
    const ovr = 30 + Math.floor(Math.random() * 16);
    for(let i=0; i<16; i++) {
      const pOvr = Math.max(30, ovr + Math.floor(Math.random()*10 - 5));
      const gStat = () => Math.max(30, pOvr + Math.floor(Math.random()*14 - 7));
      players.push({
        team_id: team.id,
        name: 'Bot Player ' + Math.floor(Math.random()*1000),
        age: 20,
        ovr: pOvr,
        potential_limit: pOvr+5,
        position: BOT_POSITIONS[i].pos,
        stats: { pace: gStat(), shooting: gStat(), passing: gStat(), dribbling: gStat(), defending: gStat(), physical: gStat() },
        stamina: 100,
        lineup_status: BOT_POSITIONS[i].status,
        lineup_slot: i.toString(),
        is_nft_coach: false,
        traits: []
      });
    }
  }
  await supabaseAdmin.from('players').insert(players);
  
  const standings = teams.map(t => ({ team_id: t.id, matches_played: 0, wins: 0, draws: 0, losses: 0, points: 0, goals_for: 0, goals_against: 0 }));
  await supabaseAdmin.from('league_standings').insert(standings);
  console.log('Done!');
}
run();
