import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSSIBLE_QUESTS = [
  { type: 'play_match', target: 1, fc: 200, sp: 5 },
  { type: 'train_squad', target: 1, fc: 150, sp: 10 },
  { type: 'sync_steps', target: 1000, fc: 250, sp: 5 },
  { type: 'friendly_match', target: 1, fc: 100, sp: 5 },
  { type: 'social_action', target: 1, fc: 150, sp: 5 }, // send friend request or challenge
];

export async function POST(req: Request) {
  try {
    const userId = await verifySession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if quests exist for today
    const { data: existing } = await supabaseAdmin
      .from('daily_quests')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, generated: false });
    }

    // Generate 3 random unique quests
    const shuffled = [...POSSIBLE_QUESTS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    const inserts = selected.map(q => ({
      user_id: userId,
      date: today,
      quest_type: q.type,
      target_value: q.target,
      reward_fc: Math.floor(q.fc * 0.55), // E1: 45% quest FC nerf
      reward_sp: q.sp
    }));

    const { error } = await supabaseAdmin.from('daily_quests').insert(inserts);

    if (error) {
       // if unique constraint error, it means another request already generated them
       if (error.code === '23505') return NextResponse.json({ success: true, generated: false });
       throw error;
    }

    return NextResponse.json({ success: true, generated: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
