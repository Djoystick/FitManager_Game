import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const firstNames = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mateo', 'Sebastian', 'Jack', 'Owen', 'Theodore'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];

const AVAILABLE_TRAITS = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];

function generatePlayer(teamId: string, position: string, status: string, isFreeAgent = false) {
  let stats = {
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

async function generateSchedule(instanceId: string, teamIds: string[]) {
  const matchesToInsert = [];
  const numTeams = teamIds.length;
  const numRounds = numTeams - 1;
  const halfSize = numTeams / 2;
  let teams = [...teamIds];

  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < halfSize; i++) {
      const home = teams[i];
      const away = teams[numTeams - 1 - i];
      if (round % 2 === 0 && i === 0) {
        matchesToInsert.push({ league_instance_id: instanceId, round_number: round, home_team_id: away, away_team_id: home, is_played: false });
      } else {
        matchesToInsert.push({ league_instance_id: instanceId, round_number: round, home_team_id: home, away_team_id: away, is_played: false });
      }
    }
    const firstTeam = teams[0];
    const secondTeam = teams[1];
    teams.splice(1, 1);
    teams.push(secondTeam);
  }
  await supabase.from('league_matches').insert(matchesToInsert);
}

async function main() {
  console.log("Starting Universe Seeding...");

  console.log("1. Wiping database...");
  await supabase.from('market_listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('league_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('league_standings').delete().neq('team_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('league_instances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('infrastructure').delete().neq('team_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("2. Creating System User for Market Seeding...");
  const { data: sysUser, error: sysUserErr } = await supabase.from('users').insert({
    telegram_id: 'sys_000',
    balance_fancoins: 999999999,
    balance_ton: 999999999
  }).select('id').single();

  if (sysUserErr) throw sysUserErr;

  const { data: sysTeam, error: sysTeamErr } = await supabase.from('teams').insert({
    user_id: sysUser.id,
    name: 'Free Agents Pool'
  }).select('id').single();

  if (sysTeamErr) throw sysTeamErr;

  console.log("3. Generating 1000 Free Agents...");
  const freeAgents = [];
  const positions = ['GK', 'DEF', 'MID', 'FWD'];
  for (let i = 0; i < 1000; i++) {
    const pos = positions[getRandomInt(0, positions.length - 1)];
    freeAgents.push(generatePlayer(sysTeam.id, pos, 'bench', true));
  }
  
  // Insert in batches of 500
  const { data: insertedAgents, error: agentsErr } = await supabase.from('players').insert(freeAgents.slice(0, 500)).select('id');
  if (agentsErr) throw agentsErr;
  const { data: insertedAgents2, error: agentsErr2 } = await supabase.from('players').insert(freeAgents.slice(500, 1000)).select('id');
  if (agentsErr2) throw agentsErr2;

  const allAgentsIds = [...insertedAgents.map(a => a.id), ...insertedAgents2.map(a => a.id)];

  console.log("4. Creating Market Listings for Free Agents...");
  const listings = allAgentsIds.map(id => ({
    seller_id: sysUser.id,
    player_id: id,
    price_ton: Number((Math.random() * 4.5 + 0.5).toFixed(2)), // 0.5 to 5.0 TON
    status: 'active'
  }));

  await supabase.from('market_listings').insert(listings.slice(0, 500));
  await supabase.from('market_listings').insert(listings.slice(500, 1000));

  console.log("5. Generating 15 League Instances and 210 Bot Teams...");
  for (let tier = 1; tier <= 15; tier++) {
    // League instance
    const { data: instance, error: instErr } = await supabase.from('league_instances').insert({
      tier_level: tier,
      name: `Global Tier ${tier}`,
      status: 'active'
    }).select('id').single();

    if (instErr) throw instErr;

    const teamIdsInLeague = [];

    // Create 14 teams
    for (let t = 1; t <= 14; t++) {
      const { data: botUser, error: botUserErr } = await supabase.from('users').insert({
        telegram_id: `bot_t${tier}_${t}_${Date.now()}`
      }).select('id').single();

      if (botUserErr) throw botUserErr;

      const { data: botTeam, error: botTeamErr } = await supabase.from('teams').insert({
        user_id: botUser.id,
        name: `FC Bot T${tier}#${t}`
      }).select('id').single();

      if (botTeamErr) throw botTeamErr;
      teamIdsInLeague.push(botTeam.id);

      await supabase.from('infrastructure').insert({ team_id: botTeam.id });
      await supabase.from('league_standings').insert({
        team_id: botTeam.id,
        league_instance_id: instance.id,
        points: 0
      });

      // Generate 16 players
      const squad = [
        { pos: 'GK', status: 'starting' },
        { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' },
        { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' },
        { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' },
        { pos: 'GK', status: 'bench' },
        { pos: 'DEF', status: 'bench' },
        { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' },
        { pos: 'FWD', status: 'bench' }
      ];

      const playersToInsert = squad.map(p => generatePlayer(botTeam.id, p.pos, p.status));
      await supabase.from('players').insert(playersToInsert);
    }

    // Schedule
    await generateSchedule(instance.id, teamIdsInLeague);
    console.log(`Tier ${tier} seeded.`);
  }

  console.log("Big Bang Complete!");
}

main().catch(console.error);
