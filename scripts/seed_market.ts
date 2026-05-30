import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const firstNames = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mateo', 'Sebastian', 'Jack', 'Owen', 'Theodore'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const AVAILABLE_TRAITS = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];

function generatePlayer(teamId: string, position: string, status: string, isFreeAgent = false) {
  const stats = {
    pace: Math.max(30, getRandomInt(45, isFreeAgent ? 85 : 55)),
    shooting: Math.max(30, getRandomInt(45, isFreeAgent ? 85 : 55)),
    passing: Math.max(30, getRandomInt(45, isFreeAgent ? 85 : 55)),
    defending: Math.max(30, getRandomInt(45, isFreeAgent ? 85 : 55)),
    physical: Math.max(30, getRandomInt(45, isFreeAgent ? 85 : 55)),
  };

  const ovr = Math.floor((stats.pace + stats.shooting + stats.passing + stats.defending + stats.physical) / 5);
  const name = `${firstNames[getRandomInt(0, firstNames.length - 1)]} ${lastNames[getRandomInt(0, lastNames.length - 1)]}`;
  const traits = [AVAILABLE_TRAITS[getRandomInt(0, AVAILABLE_TRAITS.length - 1)]];

  return {
    team_id: teamId,
    name,
    age: getRandomInt(18, 25),
    ovr,
    potential_limit: getRandomInt(ovr + 5, 90),
    is_nft_coach: false,
    position,
    stats,
    stamina: 100,
    lineup_status: status,
    traits,
    is_for_sale: isFreeAgent
  };
}

async function main() {
  console.log("Seeding Market...");

  let { data: sysUser } = await supabase.from('users').select('id').eq('telegram_id', 'sys_000').single();
  
  if (!sysUser) {
    const { data: newUser } = await supabase.from('users').insert({
      telegram_id: 'sys_000', balance_fancoins: 999999999, balance_ton: 999999999
    }).select('id').single();
    sysUser = newUser;
  }

  let { data: sysTeam } = await supabase.from('teams').select('id').eq('name', 'Free Agents Pool').single();
  if (!sysTeam) {
    const { data: newTeam } = await supabase.from('teams').insert({
      user_id: sysUser!.id, name: 'Free Agents Pool'
    }).select('id').single();
    sysTeam = newTeam;
  }

  console.log("Generating 500 Free Agents...");
  const freeAgents = [];
  const positions = ['GK', 'DEF', 'MID', 'FWD'];
  for (let i = 0; i < 500; i++) {
    const pos = positions[getRandomInt(0, positions.length - 1)];
    freeAgents.push(generatePlayer(sysTeam!.id, pos, 'bench', true));
  }
  
  const { data: insertedAgents, error } = await supabase.from('players').insert(freeAgents).select('id');
  if (error) throw error;

  console.log("Creating Market Listings...");
  const listings = insertedAgents.map(a => ({
    seller_id: sysUser!.id,
    player_id: a.id,
    price_ton: Number((Math.random() * 4.5 + 0.5).toFixed(2)),
    status: 'active'
  }));

  await supabase.from('market_listings').insert(listings);

  console.log("Market Seeding Complete!");
}

main().catch(console.error);
