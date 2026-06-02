import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { executeBotSeeding } from '@/app/actions/adminActions';
import { generateLeagueSchedule } from '@/app/actions/calendarActions';

export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const AVAILABLE_TRAITS = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];

import { getRandomName } from '@/app/utils/nameGenerator';

function generatePlayer(teamId: string, position: string, lineup_status: string = 'starting', lineup_slot: string | null = null) {
  const stats: PlayerStats = {
    pace: getRandomInt(45, 65),
    shooting: getRandomInt(45, 65),
    passing: getRandomInt(45, 65),
    defending: getRandomInt(45, 65),
    physical: getRandomInt(45, 65),
  };
  
  const ovr = Math.floor((stats.pace + stats.shooting + stats.passing + stats.defending + stats.physical) / 5);
  const age = getRandomInt(18, 25);
  
  const name = getRandomName();
  
  const traitsRoll = Math.random();
  let numTraits = 0;
  if (traitsRoll >= 0.85) {
    numTraits = 2;
  } else if (traitsRoll >= 0.30) {
    numTraits = 1;
  }

  const traits: string[] = [];
  const available = [...AVAILABLE_TRAITS];
  for (let i = 0; i < numTraits; i++) {
    const idx = getRandomInt(0, available.length - 1);
    traits.push(available.splice(idx, 1)[0]);
  }
  
  return {
    team_id: teamId,
    name,
    age,
    ovr,
    potential_limit: getRandomInt(ovr + 5, 90),
    is_nft_coach: false,
    position,
    stats,
    stamina: 100,
    lineup_status,
    lineup_slot,
    traits
  };
}

export async function POST(req: Request) {
  try {
    const { userId, teamName } = await req.json();

    if (!userId || !teamName) {
      return NextResponse.json({ error: 'Missing userId or teamName' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // === WIPE PHASE ===
    // 1. Delete user's current team (cascades players, chemistry, standings, user matches)
    await supabaseAdmin.from('teams').delete().eq('user_id', userId);
    
    // 2. Delete all bot users (cascades their teams, players, standings, matches)
    await supabaseAdmin.from('users').delete().like('telegram_id', 'bot_%');
    
    // 3. Force clean calendar (in case cascade left anything)
    await supabaseAdmin.from('league_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // === CREATE PHASE ===
    // 4. Create new team for user
    const { data: newTeam, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({ user_id: userId, name: teamName })
      .select()
      .single();

    if (teamError || !newTeam) {
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    // 5. Procedural Squad Generation (16 Players)
    const positions = [
      { pos: 'GK', status: 'starting' },
      { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' },
      { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' },
      { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' },
      { pos: 'GK', status: 'bench' },
      { pos: 'DEF', status: 'bench' },
      { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' },
      { pos: 'FWD', status: 'bench' }
    ];

    const playersToInsert = positions.map((p, index) => generatePlayer(newTeam.id, p.pos, p.status, index.toString()));

    // 6. Batch Insert Players
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .insert(playersToInsert)
      .select();

    if (playersError) {
      // Rollback team creation if players fail
      await supabaseAdmin.from('teams').delete().eq('id', newTeam.id);
      return NextResponse.json({ error: 'Failed to generate players, team creation rolled back', details: playersError.message }, { status: 500 });
    }

    // 7. Initialize user's league standings
    await supabaseAdmin.from('league_standings').insert({ team_id: newTeam.id });

    // 8. Initialize user's infrastructure
    await supabaseAdmin.from('infrastructure').insert({ team_id: newTeam.id });

    // === COLD START PHASE ===
    // 9. Seed the league with 13 fresh bot teams
    const seedRes = await executeBotSeeding(supabaseAdmin);
    if (!seedRes.success) {
      console.warn("Failed to seed bot league:", seedRes.error);
      // We don't rollback user team, but schedule won't generate properly
    }

    // 10. Generate full calendar grid for the 14 teams
    const calRes = await generateLeagueSchedule();
    if (!calRes.success) {
      console.warn("Failed to generate schedule:", calRes.error);
    }

    // 11. Unlock WELCOME achievement
    const { checkAndUnlockAchievement } = await import('@/app/services/achievementService');
    await checkAndUnlockAchievement(newTeam.id, 'WELCOME');

    return NextResponse.json({
      success: true,
      team: newTeam,
      players
    });

  } catch (error: any) {
    console.error("Team Creation API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
