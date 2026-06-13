import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, questId } = await req.json();
    if (!userId || !questId) return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch quest
    const { data: quest, error: questErr } = await supabaseAdmin
      .from('daily_quests')
      .select('*')
      .eq('id', questId)
      .eq('user_id', userId)
      .single();

    if (questErr || !quest) {
      return NextResponse.json({ success: false, error: 'Quest not found' }, { status: 404 });
    }

    if (quest.is_claimed) {
      return NextResponse.json({ success: false, error: 'Already claimed' }, { status: 400 });
    }

    if (quest.current_value < quest.target_value) {
      return NextResponse.json({ success: false, error: 'Not completed yet' }, { status: 400 });
    }

    // 2. Mark as claimed
    const { error: updErr } = await supabaseAdmin
      .from('daily_quests')
      .update({ is_claimed: true })
      .eq('id', questId)
      .eq('is_claimed', false); // OCC

    if (updErr) {
      return NextResponse.json({ success: false, error: 'Failed to claim' }, { status: 500 });
    }

    // 3. Grant rewards
    await supabaseAdmin.rpc('safe_credit_treasury', {
      p_user_id: userId,
      p_amount: quest.reward_fc,
      p_currency: 'fancoins',
      p_activity_type: 'daily_quest_reward'
    });
    
    // We don't have safe_credit_treasury for SP right now, we can just update users table directly for SP
    if (quest.reward_sp > 0) {
      await supabaseAdmin.rpc('execute_sql', {
        sql: `UPDATE users SET scouting_points = scouting_points + ${quest.reward_sp} WHERE id = '${userId}'`
      });
    }

    // 4. Check if all 3 are claimed
    const { data: allQuests } = await supabaseAdmin
      .from('daily_quests')
      .select('is_claimed')
      .eq('user_id', userId)
      .eq('date', today);
      
    let bonusGranted = false;
    if (allQuests && allQuests.length === 3 && allQuests.every(q => q.is_claimed)) {
      // Grant bonus: 500 FC + 50 SP
      await supabaseAdmin.rpc('safe_credit_treasury', {
        p_user_id: userId,
        p_amount: 500,
        p_currency: 'fancoins',
        p_activity_type: 'daily_quest_bonus'
      });
      await supabaseAdmin.rpc('execute_sql', {
        sql: `UPDATE users SET scouting_points = scouting_points + 50 WHERE id = '${userId}'`
      });
      bonusGranted = true;
    }

    return NextResponse.json({ success: true, bonusGranted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
