import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { getGoogleOAuthClient } from '@/lib/googleFitness';
import { fitness_v1, google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { timezoneDate, timezoneOffsetMins } = await req.json();

    if (!timezoneDate) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_refresh_token, daily_steps, sweat_points, last_step_sync')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.google_refresh_token) {
      return NextResponse.json({ error: 'Google Fit not connected', not_connected: true }, { status: 403 });
    }

    // 2. Init Google Auth
    const { origin } = new URL(req.url);
    const oauth2Client = getGoogleOAuthClient(origin);
    oauth2Client.setCredentials({ refresh_token: user.google_refresh_token });
    
    const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

    // 3. Calculate time bounds (From midnight to now in user's timezone)
    const now = new Date();
    // Use offset to find midnight. Offset is in minutes (e.g., -180 for UTC+3)
    const offsetMins = typeof timezoneOffsetMins === 'number' ? timezoneOffsetMins : now.getTimezoneOffset();
    
    // Create a Date representing midnight in the user's local time
    // A simple approximation:
    const localNow = new Date(now.getTime() - (offsetMins * 60000));
    const localMidnight = new Date(localNow);
    localMidnight.setUTCHours(0, 0, 0, 0);
    
    // Convert back to UTC for the API request
    const startTimeMillis = localMidnight.getTime() + (offsetMins * 60000);
    const endTimeMillis = now.getTime();

    // 4. Request Google Fit Aggregate
    const response: any = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
        }],
        bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
        startTimeMillis,
        endTimeMillis
      }
    } as any);

    let totalStepsToday = 0;
    const buckets = response.data.bucket || [];
    for (const bucket of buckets) {
      if (bucket.dataset) {
        for (const dataset of bucket.dataset) {
          if (dataset.point) {
            for (const point of dataset.point) {
              if (point.value && point.value.length > 0) {
                totalStepsToday += point.value[0].intVal || 0;
              }
            }
          }
        }
      }
    }

    // 5. Call the sync_daily_steps RPC with total steps and local date
    const { data: rpcResult, error: rpcError } = await supabase.rpc('sync_daily_steps', {
      p_user_id:           userId,
      p_total_steps_today: totalStepsToday,
      p_tz_date:           timezoneDate,
    });

    if (rpcError) {
      console.error('Sync API RPC Error:', rpcError);
      return NextResponse.json({ error: 'Failed to sync steps' }, { status: 500 });
    }
    
    // rpcResult is an object like { added_steps, sp_gained, total_sp, daily_steps }
    const spRewarded = rpcResult?.sp_gained || 0;
    const addedSteps = rpcResult?.added_steps || 0;
    const currentDailySteps = rpcResult?.daily_steps || 0;

    if (addedSteps <= 0) {
      return NextResponse.json({
        success: true,
        earned_sp: 0,
        balance_sp: user.sweat_points,
        daily_steps_logged: currentDailySteps,
        limit_reached: currentDailySteps >= 20000,
        message: 'No new steps'
      });
    }

    // Log sync for audit
    await supabase.from('fitness_sync_logs').insert({
       user_id: userId,
       steps_synced: addedSteps,
       sp_rewarded: spRewarded,
       velocity_steps_per_min: 0 // placeholder
    });

    return NextResponse.json({
      success:            true,
      earned_sp:          spRewarded,
      balance_sp:         rpcResult?.total_sp || user.sweat_points,
      daily_steps_logged: currentDailySteps,
      limit_reached:      currentDailySteps >= 20000,
      google_fit_synced:  true
    });

  } catch (error: any) {
    console.error('Fitness Sync API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
