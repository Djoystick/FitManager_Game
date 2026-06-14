import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ACHIEVEMENTS } from '@/app/services/achievementService';
import { verifySession } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: teamData } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!teamData) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Fetch unlocked achievements
    const { data: unlockedData, error } = await supabaseAdmin
      .from('team_achievements')
      .select('achievement_code, unlocked_at')
      .eq('team_id', teamData.id);

    if (error) throw error;

    const unlockedSet = new Set(unlockedData.map(a => a.achievement_code));
    
    // Map existing achievements config into a list with unlocked status
    const achievementsList = Object.values(ACHIEVEMENTS).map(ach => ({
      ...ach,
      isUnlocked: unlockedSet.has(ach.id),
      unlockedAt: unlockedData.find(a => a.achievement_code === ach.id)?.unlocked_at || null
    }));

    return NextResponse.json(achievementsList);
  } catch (error: any) {
    console.error('[GET /api/achievements] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
