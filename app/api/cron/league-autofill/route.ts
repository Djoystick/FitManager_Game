import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { generateLeagueSchedule } from '@/app/actions/calendarActions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FIRST_NAMES = ['Bot', 'Auto', 'Cyber', 'Neon', 'Meta', 'Holo', 'Quantum', 'Plasma', 'Aura', 'Zenith', 'Echo', 'Nexus', 'Apex'];
const LAST_NAMES = ['Strikers', 'United', 'City', 'FC', 'Athletic', 'Rovers', 'Wanderers', 'Dynamos', 'Titans', 'Legends', 'Force', 'Stars'];
const BOT_POSITIONS = [
  { pos: 'GK', status: 'starting' },
  { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' }, { pos: 'DEF', status: 'starting' },
  { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' }, { pos: 'MID', status: 'starting' },
  { pos: 'FWD', status: 'starting' }, { pos: 'FWD', status: 'starting' },
  { pos: 'GK', status: 'bench' },
  { pos: 'DEF', status: 'bench' },
  { pos: 'MID', status: 'bench' }, { pos: 'MID', status: 'bench' },
  { pos: 'FWD', status: 'bench' }
];

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // ── R3 FIX: Return 401 — previously this line was commented out, allowing
      // any unauthenticated caller to create unlimited bot users/teams/players,
      // causing database bloat and performance degradation for all players.
      console.warn('[AutoFill] Unauthorized cron attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("[CRON AutoFill] Starting...");

    // 1. Find instances in 'filling' status
    const { data: fillingInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id, created_at')
      .eq('status', 'filling');

    if (!fillingInstances || fillingInstances.length === 0) {
      return NextResponse.json({ message: "No instances need filling" });
    }

    for (const instance of fillingInstances) {
      // Check capacity
      const { count } = await supabaseAdmin
        .from('league_standings')
        .select('*', { count: 'exact', head: true })
        .eq('league_instance_id', instance.id);

      const currentCount = count || 0;
      const targetCount = 14;
      
      // If it's been filling for over 12 hours OR if we just want to force fill it now for simplicity
      // In a real app, we check created_at. For now, we auto-fill if it's over 1 hour old, 
      // or if it's just triggered manually.
      const ageHours = (new Date().getTime() - new Date(instance.created_at).getTime()) / (1000 * 60 * 60);
      
      if (currentCount < targetCount && ageHours >= 0) {
        console.log(`[CRON AutoFill] Instance ${instance.id} has ${currentCount} teams. Filling with ${targetCount - currentCount} bots.`);
        
        const botsNeeded = targetCount - currentCount;
        const usersToInsert = [];
        
        for (let i = 0; i < botsNeeded; i++) {
          usersToInsert.push({
            id: crypto.randomUUID(),
            telegram_id: `bot_${crypto.randomUUID()}`,
            balance_fancoins: Math.floor(Math.random() * 5000)
          });
        }

        const { data: insertedUsers, error: usersError } = await supabaseAdmin.from('users').insert(usersToInsert).select('id');
        if (usersError || !insertedUsers) continue;

        const teamsToInsert = insertedUsers.map((user: any, idx: number) => {
          const fName = FIRST_NAMES[idx % FIRST_NAMES.length];
          const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
          return {
            id: crypto.randomUUID(),
            user_id: user.id,
            name: `${fName} ${lName}`,
            logo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
          };
        });

        const { data: insertedTeams, error: teamsError } = await supabaseAdmin.from('teams').insert(teamsToInsert).select('id');
        if (teamsError || !insertedTeams) continue;

        const playersToInsert: any[] = [];
        const pFirst = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew'];
        const pLast = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'];

        insertedTeams.forEach((team: any) => {
          const teamBaseOvr = Math.floor(Math.random() * 16) + 30; // 30-45 OVR
          
          for (let i = 0; i < 16; i++) {
            const ovr = Math.max(30, Math.min(99, teamBaseOvr + Math.floor(Math.random() * 10 - 5)));
            const generateStat = () => Math.max(30, Math.min(99, Math.round(ovr + (Math.random() * 14 - 7))));
            
            const traitsRoll = Math.random();
            let numTraits = 0;
            if (traitsRoll >= 0.85) numTraits = 2;
            else if (traitsRoll >= 0.30) numTraits = 1;

            const traits: string[] = [];
            const availableTraits = ['Sniper', 'Playmaker', 'Wall', 'Speedster', 'Anchor', 'Poacher', 'Engine'];
            for (let t = 0; t < numTraits; t++) {
              const idx = Math.floor(Math.random() * availableTraits.length);
              traits.push(availableTraits.splice(idx, 1)[0]);
            }

            playersToInsert.push({
              team_id: team.id,
              name: `${pFirst[Math.floor(Math.random() * pFirst.length)]} ${pLast[Math.floor(Math.random() * pLast.length)]}`,
              age: Math.floor(Math.random() * 15) + 18,
              ovr,
              potential_limit: Math.max(ovr, Math.floor(Math.random() * 10) + ovr),
              position: BOT_POSITIONS[i].pos,
              stats: {
                pace: generateStat(),
                shooting: generateStat(),
                passing: generateStat(),
                dribbling: generateStat(),
                defending: generateStat(),
                physical: generateStat(),
              },
              stamina: 100,
              lineup_status: BOT_POSITIONS[i].status,
              lineup_slot: i.toString(),
              is_nft_coach: false,
              traits
            });
          }
        });

        await supabaseAdmin.from('players').insert(playersToInsert);

        // Add bots to standings
        const standingsToInsert = insertedTeams.map((team: any) => ({
          team_id: team.id,
          league_instance_id: instance.id,
          matches_played: 0,
          wins: 0, draws: 0, losses: 0, points: 0,
          goals_for: 0, goals_against: 0
        }));

        await supabaseAdmin.from('league_standings').insert(standingsToInsert);

        // Activate and generate schedule
        const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('league_instances').update({ status: 'active', start_time: startTime }).eq('id', instance.id);

        // ── L2 FIX: Only generate schedule if none exists yet ────────────────
        // Prevents duplicate match rows when autofill is called multiple times
        // for the same instance (e.g. on retry after a partial failure).
        const { count: existingMatches } = await supabaseAdmin
          .from('league_matches')
          .select('*', { count: 'exact', head: true })
          .eq('league_instance_id', instance.id);

        if (!existingMatches || existingMatches === 0) {
          await generateLeagueSchedule(instance.id);
        } else {
          console.log(`[CRON AutoFill] Instance ${instance.id} already has ${existingMatches} matches — skipping schedule generation.`);
        }

        console.log(`[CRON AutoFill] Instance ${instance.id} activated and scheduled! Starts at ${startTime}`);
      } else if (currentCount >= targetCount) {
        // Just in case it's full but status didn't update
        const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('league_instances').update({ status: 'active', start_time: startTime }).eq('id', instance.id);
        await generateLeagueSchedule(instance.id);
      }
    }

    return NextResponse.json({ message: "Auto-fill processed" });
  } catch (error: any) {
    console.error("AutoFill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
