import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check friendly matches played count
    const { count, error: countError } = await supabaseAdmin
      .from('fitness_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('activity_type', 'friendly_match');

    if (countError) throw countError;

    if ((count || 0) >= 5) {
      return NextResponse.json({ success: false, error: 'Limit reached' }, { status: 403 });
    }

    // 2. Fetch team info
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) throw teamError || new Error('Team not found');

    // 3. Fetch active players to calculate OVR
    const { data: players } = await supabaseAdmin
      .from('players')
      .select('ovr')
      .eq('team_id', team.id)
      .eq('lineup_status', 'starting');

    let totalOvr = 0;
    if (players && players.length > 0) {
      totalOvr = players.reduce((sum, p) => sum + p.ovr, 0);
    }
    const avgOvr = players && players.length > 0 ? Math.round(totalOvr / players.length) : 50;

    // 4. Simulate Match
    const botOvr = avgOvr + Math.floor(Math.random() * 10) - 5; // Bot OVR is within -5 to +5 of player
    
    let playerGoals = 0;
    let botGoals = 0;

    // Simple simulation logic based on OVR difference
    const diff = avgOvr - botOvr;
    const playerChance = 50 + diff * 2; // e.g. +5 OVR diff = 60% chance to score per attack
    
    // 5 attacks each
    for (let i = 0; i < 5; i++) {
      if (Math.random() * 100 < playerChance) playerGoals++;
      if (Math.random() * 100 < (100 - playerChance)) botGoals++;
    }

    let result = 'draw';
    if (playerGoals > botGoals) result = 'win';
    if (playerGoals < botGoals) result = 'loss';

    // 5. Calculate Rewards
    const fcReward = result === 'win' ? 500 : 200;
    const spReward = result === 'win' ? 20 : 10;

    // 6. Apply Rewards
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins, sweat_points')
      .eq('id', userId)
      .single();

    if (user) {
      await supabaseAdmin
        .from('users')
        .update({
          balance_fancoins: (user.balance_fancoins || 0) + fcReward,
          sweat_points: (user.sweat_points || 0) + spReward
        })
        .eq('id', userId);
    }

    // 7. Increment friendly matches counter (log the match)
    await supabaseAdmin
      .from('fitness_logs')
      .insert({
        user_id: userId,
        activity_type: 'friendly_match',
        duration_minutes: 1,
        calories: 0,
        earned_tp: 0
      });

    // 8. Send challenge notification
    await supabaseAdmin.from('personal_notifications').insert({
      user_id: userId,
      type: 'challenge',
      title: 'Friendly match',
      message: JSON.stringify({
        en: `You played a friendly match. Result: ${playerGoals}:${botGoals}.`,
        ru: `Вы сыграли товарищеский матч. Результат: ${playerGoals}:${botGoals}.`,
      }),
    });

    return NextResponse.json({
      success: true,
      score: { home: playerGoals, away: botGoals },
      result,
      rewards: { fc: fcReward, sp: spReward },
      botName: 'Local Street Team',
      matchesPlayed: (count || 0) + 1
    });

  } catch (error: any) {
    console.error('Friendly match error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
