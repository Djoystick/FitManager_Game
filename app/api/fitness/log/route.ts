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

    // 2. TP (Training Points) Conversion Math
    let earnedTp = 0;
    const type = activityType.toLowerCase();

    if (type === 'running' || type === 'run') {
      earnedTp = Math.floor((durationMinutes * 2) + (calories / 10));
    } else if (type === 'strength') {
      earnedTp = Math.floor((durationMinutes * 3) + (calories / 15));
    } else if (type === 'yoga') {
      earnedTp = Math.floor(durationMinutes * 1);
    } else {
      // Fallback multiplier for unknown generic activities
      earnedTp = Math.floor(durationMinutes * 1);
    }

    // Ensure we don't grant negative TP on weird payloads
    earnedTp = Math.max(0, earnedTp);

    // 3. Database operations
    // Fetch current user TP securely
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance_tp')
      .eq('id', userId)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'User not found or database read error', details: userError.message },
        { status: 404 }
      );
    }

    const newBalanceTp = (user.balance_tp || 0) + earnedTp;

    // Insert the log
    const { error: logError } = await supabase
      .from('fitness_logs')
      .insert({
        user_id: userId,
        activity_type: activityType,
        duration_minutes: durationMinutes,
        calories: calories,
        earned_tp: earnedTp,
      });

    if (logError) {
      throw new Error(`Failed to insert fitness log: ${logError.message}`);
    }

    // Update user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance_tp: newBalanceTp })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update user TP balance: ${updateError.message}`);
    }

    // 4. Return formatted response
    return NextResponse.json({
      success: true,
      earned_tp: earnedTp,
      balance_tp: newBalanceTp,
    });

  } catch (error: any) {
    console.error("Fitness Log API Error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
