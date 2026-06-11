import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get the team_id for this user
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 2. Fetch infrastructure data
    const { data: infra, error: infraError } = await supabase
      .from('infrastructure')
      .select('*')
      .eq('team_id', team.id)
      .single();

    if (infraError || !infra) {
      return NextResponse.json({ error: 'Infrastructure data not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, infrastructure: infra });
  } catch (error: any) {
    console.error("Infrastructure GET API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { buildingType } = body; // buildingType: 'stadium' | 'training_camp' | 'medical_center'

    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['stadium', 'training_camp', 'medical_center'].includes(buildingType)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Get team_id
    const teamRes = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamRes.error || !teamRes.data) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamId = teamRes.data.id;

    // 2. Get current infrastructure level
    const { data: infra, error: infraError } = await supabase
      .from('infrastructure')
      .select(`${buildingType}_level`)
      .eq('team_id', teamId)
      .single();

    if (infraError || !infra) {
      return NextResponse.json({ error: 'Infrastructure not found' }, { status: 404 });
    }

    const currentLevel = infra[`${buildingType}_level` as keyof typeof infra] as number;
    const upgradeCost = currentLevel * 1000;

    // 3. Atomic deduction via RPC (C4 fix — prevents race condition)
    const { data: newBalance, error: deductError } = await supabase.rpc('deduct_fancoins', { 
      user_id: userId, 
      amount: upgradeCost 
    });

    if (deductError) {
      return NextResponse.json({ error: 'Insufficient FanCoins or transaction failed' }, { status: 400 });
    }

    // 4. Increment level
    const newLevel = currentLevel + 1;
    const { data: updatedInfra, error: upgradeErr } = await supabase
      .from('infrastructure')
      .update({ [`${buildingType}_level`]: newLevel })
      .eq('team_id', teamId)
      .select()
      .single();

    if (upgradeErr) {
      console.error("Infrastructure upgrade error:", upgradeErr);
      return NextResponse.json({ error: 'Failed to upgrade infrastructure' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      infrastructure: updatedInfra,
      new_balance: newBalance
    });

  } catch (error: any) {
    console.error("Infrastructure POST API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
