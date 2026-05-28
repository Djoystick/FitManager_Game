import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface FitnessLogRequest {
  userId: string;
  activityType: string;
  durationMinutes: number;
  calories: number;
}

export async function POST(req: Request) {
  try {
    const body: Partial<FitnessLogRequest> = await req.json();
    const { userId, activityType, durationMinutes, calories } = body;

    // 1. Basic validation
    if (!userId || !activityType || durationMinutes === undefined || calories === undefined) {
      return NextResponse.json(
        { error: 'Missing required payload fields: userId, activityType, durationMinutes, or calories' },
        { status: 400 }
      );
    }

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'durationMinutes must be greater than 0' },
        { status: 400 }
      );
    }

    // 2. Sweat Points (SP) Conversion Math
    // SP replaces the legacy TP system entirely.
    let earnedSp = 0;
    const type = activityType.toLowerCase();

    if (type === 'running' || type === 'run') {
      earnedSp = Math.floor((durationMinutes * 2) + (calories / 10));
    } else if (type === 'strength') {
      earnedSp = Math.floor((durationMinutes * 3) + (calories / 15));
    } else if (type === 'yoga') {
      earnedSp = Math.floor(durationMinutes * 1);
    } else {
      earnedSp = Math.floor(durationMinutes * 1);
    }

    earnedSp = Math.max(0, earnedSp);

    // 2.5 ANTI-CHEAT: Daily diminishing returns & hard cap
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error: logsError } = await supabase
      .from('fitness_logs')
      .select('activity_type, earned_tp')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);

    if (logsError) {
      return NextResponse.json(
        { error: 'Failed to verify anti-cheat daily limits', details: logsError.message },
        { status: 500 }
      );
    }

    let sameActivityCount = 0;
    let dailyTotalSp = 0;

    if (recentLogs) {
      for (const log of recentLogs) {
        // earned_tp column still exists in fitness_logs as historical record
        dailyTotalSp += log.earned_tp;
        if (log.activity_type.toLowerCase() === activityType.toLowerCase()) {
          sameActivityCount++;
        }
      }
    }

    // Diminishing Returns (10% penalty per repeat, max 50%)
    const diminishingPenalty = Math.min(sameActivityCount * 10, 50);
    if (diminishingPenalty > 0) {
      earnedSp = Math.floor(earnedSp * (1 - diminishingPenalty / 100));
    }

    // Daily Hard Cap
    const MAX_DAILY_SP = 500;
    let dailyLimitReached = false;

    if (dailyTotalSp >= MAX_DAILY_SP) {
      earnedSp = 0;
      dailyLimitReached = true;
    } else if (dailyTotalSp + earnedSp > MAX_DAILY_SP) {
      earnedSp = MAX_DAILY_SP - dailyTotalSp;
      dailyLimitReached = true;
    }

    // 3. Insert log record (earned_tp column kept for historical queries)
    const { error: logError } = await supabase
      .from('fitness_logs')
      .insert({
        user_id:          userId,
        activity_type:    activityType,
        duration_minutes: durationMinutes,
        calories:         calories,
        earned_tp:        earnedSp, // stored in earned_tp for schema compat
      });

    if (logError) {
      throw new Error(`Failed to insert fitness log: ${logError.message}`);
    }

    // 4. Credit SP to user via direct update (no column reference to balance_tp)
    const { data: user, error: userFetchErr } = await supabase
      .from('users')
      .select('sweat_points')
      .eq('id', userId)
      .single();

    if (userFetchErr || !user) {
      throw new Error('User not found while crediting SP');
    }

    const newSpBalance = (user.sweat_points || 0) + earnedSp;

    const { error: updateError } = await supabase
      .from('users')
      .update({ sweat_points: newSpBalance })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update Sweat Points balance: ${updateError.message}`);
    }

    return NextResponse.json({
      success:        true,
      earned_sp:      earnedSp,
      balance_sp:     newSpBalance,
      meta: {
        dailyLimitReached,
        diminishingPenalty,
      },
    });

  } catch (error: any) {
    console.error('Fitness Log API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
