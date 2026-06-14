import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const userId = await verifySession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { questId } = await req.json();
    if (!questId) return NextResponse.json({ success: false, error: 'Missing questId' }, { status: 400 });

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

    // 3. Grant FC rewards via atomic RPC
    await supabaseAdmin.rpc('safe_credit_treasury', {
      p_user_id: userId,
      p_amount: quest.reward_fc,
      p_currency: 'fancoins',
      p_activity_type: 'daily_quest_reward'
    });

    // 4. Grant SP rewards via standard .update() (no execute_sql)
    if (quest.reward_sp > 0) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('scouting_points')
        .eq('id', userId)
        .single();

      if (userData) {
        await supabaseAdmin
          .from('users')
          .update({ scouting_points: (userData.scouting_points || 0) + quest.reward_sp })
          .eq('id', userId);
      }
    }

    // 5. Check if all 3 are claimed
    const { data: allQuests } = await supabaseAdmin
      .from('daily_quests')
      .select('is_claimed')
      .eq('user_id', userId)
      .eq('date', today);

    let bonusGranted = false;
    if (allQuests && allQuests.length === 3 && allQuests.every(q => q.is_claimed)) {
      // Grant bonus: 500 FC
      await supabaseAdmin.rpc('safe_credit_treasury', {
        p_user_id: userId,
        p_amount: 500,
        p_currency: 'fancoins',
        p_activity_type: 'daily_quest_bonus'
      });

      // Grant bonus: 50 SP via standard update
      const { data: bonusUserData } = await supabaseAdmin
        .from('users')
        .select('scouting_points')
        .eq('id', userId)
        .single();

      if (bonusUserData) {
        await supabaseAdmin
          .from('users')
          .update({ scouting_points: (bonusUserData.scouting_points || 0) + 50 })
          .eq('id', userId);
      }

      bonusGranted = true;
    }

    return NextResponse.json({ success: true, bonusGranted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
