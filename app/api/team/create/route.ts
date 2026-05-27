import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

function generatePlayer(teamId: string, position: string, lineup_status: string = 'starting') {
  const stats: PlayerStats = {
    pace: getRandomInt(45, 65),
    shooting: getRandomInt(45, 65),
    passing: getRandomInt(45, 65),
    defending: getRandomInt(45, 65),
    physical: getRandomInt(45, 65),
  };
  
  const ovr = Math.floor((stats.pace + stats.shooting + stats.passing + stats.defending + stats.physical) / 5);
  const age = getRandomInt(18, 25);
  
  const firstNames = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mateo', 'Sebastian', 'Jack', 'Owen', 'Theodore'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  const name = `${firstNames[getRandomInt(0, firstNames.length - 1)]} ${lastNames[getRandomInt(0, lastNames.length - 1)]}`;
  
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
    traits
  };
}

export async function POST(req: Request) {
  try {
    const { userId, teamName } = await req.json();

    if (!userId || !teamName) {
      return NextResponse.json({ error: 'Missing userId or teamName' }, { status: 400 });
    }

    // 1. Validation: Check if user already has a team
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json({ error: 'Database error checking existing teams' }, { status: 500 });
    }

    if (existingTeam) {
      return NextResponse.json({ error: 'User already has a franchise' }, { status: 400 });
    }

    // 2. Team Creation
    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert({ user_id: userId, name: teamName })
      .select()
      .single();

    if (teamError || !newTeam) {
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    // 3. Procedural Squad Generation (16 Players)
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

    const playersToInsert = positions.map(p => generatePlayer(newTeam.id, p.pos, p.status));

    // 4. Batch Insert Players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select();

    if (playersError) {
      // Rollback team creation if players fail
      await supabase.from('teams').delete().eq('id', newTeam.id);
      return NextResponse.json({ error: 'Failed to generate players, team creation rolled back', details: playersError.message }, { status: 500 });
    }

    // 5. Initialize league standings
    await supabase.from('league_standings').insert({ team_id: newTeam.id });

    // 6. Initialize infrastructure
    await supabase.from('infrastructure').insert({ team_id: newTeam.id });

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
