import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface FitnessLogRequest {
  activityType: string;
  durationMinutes: number;
  calories: number;
}

export async function POST(req: Request) {
  try {
    const body: Partial<FitnessLogRequest> = await req.json();
    const { activityType, durationMinutes, calories } = body;

    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Basic validation
    if (!activityType || durationMinutes === undefined || calories === undefined) {
      return NextResponse.json(
        { error: 'Missing required payload fields: activityType, durationMinutes, or calories' },
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

    // 4. Credit SP to user via atomic RPC
    const { data: newSpBalance, error: updateError } = await supabaseAdmin
      .rpc('increment_sweat_points', { u_id: userId, amount: earnedSp });

    if (updateError) {
      throw new Error(`Failed to credit Sweat Points: ${updateError.message}`);
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
