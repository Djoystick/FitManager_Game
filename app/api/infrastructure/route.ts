import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
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
    const { userId, buildingType } = body; // buildingType: 'stadium' | 'training_camp' | 'medical_center'

    if (!userId || !['stadium', 'training_camp', 'medical_center'].includes(buildingType)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Get user data for FanCoins balance and team_id
    const [userRes, teamRes] = await Promise.all([
      supabase.from('users').select('balance_fancoins').eq('id', userId).single(),
      supabase.from('teams').select('id').eq('user_id', userId).single()
    ]);

    if (userRes.error || !userRes.data || teamRes.error || !teamRes.data) {
      return NextResponse.json({ error: 'User or Team not found' }, { status: 404 });
    }

    const currentFancoins = userRes.data.balance_fancoins;
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

    // 3. Check balance
    if (currentFancoins < upgradeCost) {
      return NextResponse.json({ error: 'Insufficient FanCoins' }, { status: 400 });
    }

    // 4. Perform upgrade (deduct coins and increment level)
    const newBalance = currentFancoins - upgradeCost;
    const newLevel = currentLevel + 1;

    // Use a Promise.all to pseudo-transaction this for MVP
    const [updateUserRes, updateInfraRes] = await Promise.all([
      supabase.from('users').update({ balance_fancoins: newBalance }).eq('id', userId),
      supabase.from('infrastructure').update({ [`${buildingType}_level`]: newLevel }).eq('team_id', teamId).select().single()
    ]);

    if (updateUserRes.error || updateInfraRes.error) {
      console.error("Upgrade error:", updateUserRes.error, updateInfraRes.error);
      return NextResponse.json({ error: 'Failed to process upgrade transaction' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      infrastructure: updateInfraRes.data,
      new_balance: newBalance
    });

  } catch (error: any) {
    console.error("Infrastructure POST API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
