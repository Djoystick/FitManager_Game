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
      .select('google_refresh_token, daily_steps_logged, sweat_points')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.google_refresh_token) {
      return NextResponse.json({ error: 'Google Fit not connected', not_connected: true }, { status: 403 });
    }

    // 2. Init Google Auth
    const oauth2Client = getGoogleOAuthClient();
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
          dataTypeName: 'com.google.step_count.delta',
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
        }],
        bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
        startTimeMillis,
        endTimeMillis
      }
    } as any);

    let totalStepsToday = 0;
    const bucket = response.data.bucket?.[0];
    if (bucket && bucket.dataset && bucket.dataset[0].point && bucket.dataset[0].point.length > 0) {
       const point = bucket.dataset[0].point[0];
       if (point.value && point.value.length > 0) {
         totalStepsToday = point.value[0].intVal || 0;
       }
    }

    // 5. Calculate Delta
    // If the day changed, daily_steps_logged in DB should ideally be 0, but sync_daily_steps RPC handles the reset based on today_date.
    // However, if we just send the total delta since we last knew about today.
    // The RPC expects 'steps_to_add'. We need to be careful if the RPC resets daily_steps_logged when today_date changes.
    // If the RPC resets it to 0, and we send `totalStepsToday`, then the RPC adds `totalStepsToday` to 0. This works perfectly.
    // Wait, if it DOESN'T reset it because the day didn't change, we need to send `totalStepsToday - user.daily_steps_logged`.
    
    // For safety, let's just use the RPC to add steps, so we calculate delta:
    // If user.daily_steps_logged is from YESTERDAY, the RPC will reset it internally.
    // To know if it's from yesterday, we can't easily tell unless we query the DB's current tracked date.
    // Actually, the simplest way is to fetch the current tracked date from `users.last_step_date` (assuming it exists).
    
    // Let's query last_step_date
    const { data: dateData } = await supabase.from('users').select('last_step_date').eq('id', userId).single();
    let delta = totalStepsToday;
    
    if (dateData?.last_step_date === timezoneDate) {
       delta = totalStepsToday - (user.daily_steps_logged || 0);
    }
    
    if (delta <= 0) {
      return NextResponse.json({
        success: true,
        earned_sp: 0,
        balance_sp: user.sweat_points,
        daily_steps_logged: user.daily_steps_logged,
        limit_reached: user.daily_steps_logged >= 20000,
        message: 'No new steps'
      });
    }

    // 6. Velocity Anti-Cheat Check
    // (Optional for MVP: check if delta > physically possible in the elapsed time)
    // For now, hard cap at 20000 in the RPC prevents infinite farming.
    
    // 7. Call the sync_daily_steps RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('sync_daily_steps', {
      u_id:         userId,
      steps_to_add: delta,
      today_date:   timezoneDate, 
    });

    if (rpcError) {
      console.error('Sync API RPC Error:', rpcError);
      return NextResponse.json({ error: 'Failed to sync steps' }, { status: 500 });
    }
    
    // Log sync for audit
    await supabase.from('fitness_sync_logs').insert({
       user_id: userId,
       steps_synced: delta,
       sp_rewarded: rpcResult,
       velocity_steps_per_min: 0 // placeholder
    });

    // 8. Fetch updated state
    const { data: updatedUser } = await supabase
      .from('users')
      .select('sweat_points, daily_steps_logged')
      .eq('id', userId)
      .single();

    return NextResponse.json({
      success:            true,
      earned_sp:          rpcResult,
      balance_sp:         updatedUser?.sweat_points || user.sweat_points,
      daily_steps_logged: updatedUser?.daily_steps_logged || user.daily_steps_logged,
      limit_reached:      (updatedUser?.daily_steps_logged || 0) >= 20000,
      google_fit_synced:  true
    });

  } catch (error: any) {
    console.error('Fitness Sync API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
