import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Starting manual end-of-season...');
  const { data: activeInstances } = await supabaseAdmin
    .from('league_instances')
    .select('id, tier_level')
    .eq('status', 'active');

  if (!activeInstances || activeInstances.length === 0) {
    console.log('No active instances');
    return;
  }

  for (const instance of activeInstances) {
    const { count: unplayedCount } = await supabaseAdmin
      .from('league_matches')
      .select('*', { count: 'exact', head: true })
      .eq('league_instance_id', instance.id)
      .eq('is_played', false);

    if (unplayedCount !== null && unplayedCount > 0) {
      console.log(`Instance ${instance.id} has ${unplayedCount} unplayed matches.`);
      continue;
    }

    console.log(`Ending season for instance ${instance.id}...`);
    
    await supabaseAdmin
      .from('league_instances')
      .update({ status: 'finishing' })
      .eq('id', instance.id)
      .eq('status', 'active');

    const { data: finalStandings } = await supabaseAdmin
      .from('league_standings')
      .select('*')
      .eq('league_instance_id', instance.id)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('goals_for', { ascending: false })
      .order('matches_played', { ascending: true });

    if (!finalStandings || finalStandings.length === 0) continue;

    const newAssignments: { team_id: string; new_tier: number }[] = [];

    for (let i = 0; i < finalStandings.length; i++) {
      let nextTier = instance.tier_level;
      if (i < 3) nextTier = Math.max(1, instance.tier_level - 1);
      else if (i >= finalStandings.length - 3) nextTier = Math.min(10, instance.tier_level + 1);

      const { data: teamData } = await supabaseAdmin
        .from('teams')
        .select('user_id, name')
        .eq('id', finalStandings[i].team_id)
        .single();

      if (teamData?.user_id) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('telegram_id')
          .eq('id', teamData.user_id)
          .single();

        if (userData && !userData.telegram_id.startsWith('bot_')) {
          newAssignments.push({ team_id: finalStandings[i].team_id, new_tier: nextTier });
        }
      }
    }

    console.log(`Migrating ${newAssignments.length} real users...`);

    for (const assignment of newAssignments) {
      let targetInstanceId: string | undefined;

      const { data: openInstances } = await supabaseAdmin
        .from('league_instances')
        .select('id')
        .eq('tier_level', assignment.new_tier)
        .eq('status', 'filling')
        .order('created_at', { ascending: true })
        .limit(1);

      if (openInstances && openInstances.length > 0) {
        targetInstanceId = openInstances[0].id;
      } else {
        const { data: newInstance } = await supabaseAdmin
          .from('league_instances')
          .insert({
            tier_level: assignment.new_tier,
            name: `Sector ${Math.floor(Math.random() * 900) + 100}`,
            status: 'filling'
          })
          .select('id')
          .single();
        targetInstanceId = newInstance!.id;
      }

      await supabaseAdmin.from('league_standings').insert({
        team_id: assignment.team_id,
        league_instance_id: targetInstanceId,
        points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, form: 50, season_reward_paid: false
      });
    }

    await supabaseAdmin
      .from('league_instances')
      .update({ status: 'finished' })
      .eq('id', instance.id);

    console.log(`Successfully finished season ${instance.id}`);
  }
}

run().catch(console.error);
