import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

const MAX_FRIENDLIES = 5;
const MAX_CAMPS_PER_SEASON = 3;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check friendly matches played count (lifetime)
    const { count, error: countError } = await supabaseAdmin
      .from('fitness_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('activity_type', 'friendly_match');

    if (countError) throw countError;

    const playedFriendlies = count || 0;
    const isTrainingCamp = playedFriendlies >= MAX_FRIENDLIES;

    // 2. If training camp, check season limit
    if (isTrainingCamp) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id, season_camps_played')
        .eq('user_id', userId)
        .single();

      if (!team) throw new Error('Team not found');

      if ((team.season_camps_played || 0) >= MAX_CAMPS_PER_SEASON) {
        return NextResponse.json({
          success: false,
          error: `Training camp limit reached for this season (${MAX_CAMPS_PER_SEASON} max).`,
          errorKey: 'camp_limit_reached',
        }, { status: 403 });
      }
    }

    // 3. Fetch team info
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) throw teamError || new Error('Team not found');

    // 4. Fetch active players to calculate OVR
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

    // 5. Simulate Match
    const botOvr = avgOvr + Math.floor(Math.random() * 10) - 5;
    
    let playerGoals = 0;
    let botGoals = 0;

    const diff = avgOvr - botOvr;
    const playerChance = 50 + diff * 2;
    
    for (let i = 0; i < 5; i++) {
      if (Math.random() * 100 < playerChance) playerGoals++;
      if (Math.random() * 100 < (100 - playerChance)) botGoals++;
    }

    let result = 'draw';
    if (playerGoals > botGoals) result = 'win';
    if (playerGoals < botGoals) result = 'loss';

    // 6. Apply Rewards based on mode
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins, sweat_points')
      .eq('id', userId)
      .single();

    let fcReward = 0;
    let spReward = 0;
    let matchType = 'friendly';

    if (isTrainingCamp) {
      // Training Camp: No FC/SP rewards, but boost morale and form
      matchType = 'training_camp';

      // Boost morale (+15) and OVR/form (+10 temporary via stats) for all starting players
      const { data: squadPlayers } = await supabaseAdmin
        .from('players')
        .select('id, morale, stats')
        .eq('team_id', team.id)
        .eq('lineup_status', 'starting');

      if (squadPlayers) {
        await Promise.all(squadPlayers.map(p => {
          const newMorale = Math.min(100, (p.morale ?? 70) + 15);
          // Boost pace and physical by +10 (form boost)
          const currentStats = p.stats || {};
          const newStats = {
            ...currentStats,
            pac: Math.min(99, (currentStats.pac || 50) + 10),
            phy: Math.min(99, (currentStats.phy || 50) + 10),
          };
          return supabaseAdmin
            .from('players')
            .update({ morale: newMorale, stats: newStats })
            .eq('id', p.id);
        }));
      }

      // Increment camp counter
      await supabaseAdmin
        .from('teams')
        .update({ season_camps_played: (await supabaseAdmin
          .from('teams')
          .select('season_camps_played')
          .eq('id', team.id)
          .single()
        ).data?.season_camps_played + 1 || 1 })
        .eq('id', team.id);

    } else {
      // Regular friendly match rewards
      fcReward = result === 'win' ? 500 : 200;
      spReward = result === 'win' ? 20 : 10;

      if (user) {
        await supabaseAdmin
          .from('users')
          .update({
            balance_fancoins: (user.balance_fancoins || 0) + fcReward,
            sweat_points: (user.sweat_points || 0) + spReward
          })
          .eq('id', userId);
      }
    }

    // 7. Log the match
    await supabaseAdmin
      .from('fitness_logs')
      .insert({
        user_id: userId,
        activity_type: isTrainingCamp ? 'training_camp' : 'friendly_match',
        duration_minutes: 1,
        calories: 0,
        earned_tp: 0
      });

    // 8. Send notification
    await supabaseAdmin.from('personal_notifications').insert({
      user_id: userId,
      type: isTrainingCamp ? 'training' : 'challenge',
      title: isTrainingCamp ? 'Training Camp' : 'Friendly match',
      message: JSON.stringify({
        en: isTrainingCamp
          ? `Training camp complete! Your team's morale and form have improved.`
          : `You played a friendly match. Result: ${playerGoals}:${botGoals}.`,
        ru: isTrainingCamp
          ? `Тренировочный сбор завершен! Мораль и форма команды улучшились.`
          : `Вы сыграли товарищеский матч. Результат: ${playerGoals}:${botGoals}.`,
      }),
    });

    // Quest progress (only for regular friendlies)
    if (!isTrainingCamp) {
      await supabaseAdmin.rpc('increment_quest_progress', { p_user_id: userId, p_type: 'friendly_match', p_amount: 1 });
      await supabaseAdmin.rpc('increment_quest_progress', { p_user_id: userId, p_type: 'play_match', p_amount: 1 });
    }

    return NextResponse.json({
      success: true,
      score: { home: playerGoals, away: botGoals },
      result,
      matchType,
      rewards: { fc: fcReward, sp: spReward },
      botName: 'Local Street Team',
      matchesPlayed: playedFriendlies + 1,
      campsPlayed: isTrainingCamp ? ((await supabaseAdmin
        .from('teams')
        .select('season_camps_played')
        .eq('id', team.id)
        .single()
      ).data?.season_camps_played || 0) : undefined,
    });

  } catch (error: any) {
    console.error('Friendly match error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
