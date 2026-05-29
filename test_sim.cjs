require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSimulate() {
  try {
    const { data: unplayedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('is_played', false)
      .order('round_number', { ascending: true })
      .limit(1);

    if (!unplayedMatches || unplayedMatches.length === 0) {
      console.log('No unplayed rounds left');
      return;
    }
    const targetRound = unplayedMatches[0].round_number;
    console.log('Target Round:', targetRound);

    const { data: matches, error: mError } = await supabaseAdmin
      .from('league_matches')
      .select('*')
      .eq('round_number', targetRound)
      .eq('is_played', false);

    if (mError) {
      console.log('Error matches:', mError);
      return;
    }
    console.log(`Found ${matches.length} matches for round ${targetRound}`);

    const teamIdsInRound = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
    const { data: roundPlayers, error: pError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, name, position, ovr, lineup_slot, lineup_status, is_injured, stamina')
      .in('team_id', teamIdsInRound)
      .eq('lineup_status', 'starting')
      .eq('is_injured', false);

    console.log(`Found ${roundPlayers?.length} players`);
    
    // Simulate updating one match to see if it works
    const testMatch = matches[0];
    const { data: res, error: uError } = await supabaseAdmin.from('league_matches').update({
        home_score: 1,
        away_score: 2,
        is_played: true
      }).eq('id', testMatch.id).select();
    console.log('Update test result:', res, uError);
    
    // Rollback test
    await supabaseAdmin.from('league_matches').update({ is_played: false }).eq('id', testMatch.id);
  } catch (err) {
    console.error(err);
  }
}

testSimulate();
