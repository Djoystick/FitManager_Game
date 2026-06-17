'use server';

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { triggerScoutingAchievements } from '@/app/services/achievementService';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

import { Player, PlayerStats, generateRandomPlayer } from '@/lib/playerUtils';
import { verifySession } from '@/lib/session';

export interface ScoutResult {
  success: boolean;
  player?: Player;
  academy_bonus?: number;
  perk_granted?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────



export async function scoutYouthPlayer(): Promise<ScoutResult> {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());

    if (!tgUserId) {
      return { success: false, error: 'Unauthorized: Valid Telegram session required.' };
    }

    // 1. Fetch user's team
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', tgUserId)
      .single();

    if (teamError || !teamData) {
      return { success: false, error: 'Team not found for the current user.' };
    }

    const teamId = teamData.id;

    // 2. Read infrastructure levels (academy + scout + perks)
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('academy_level, scout_level, academy_perks')
      .eq('team_id', teamId)
      .maybeSingle();

    const academyLevel = infra?.academy_level ?? 1;
    const scoutLevel   = infra?.scout_level   ?? 1;
    const academyPerks = infra?.academy_perks ?? [];

    // 3. Generate player with infrastructure bonuses
    const { perk_granted, ...newPlayerData } = await generateRandomPlayer(teamId, academyLevel, scoutLevel, academyPerks);

    // 4. Insert into database
    const { data: insertedPlayer, error: insertError } = await supabaseAdmin
      .from('players')
      .insert(newPlayerData)
      .select('*')
      .single();

    if (insertError || !insertedPlayer) {
      console.error('Scouting Error:', insertError);
      return { success: false, error: 'Failed to sign the new player. Academy network error.' };
    }

    revalidatePath('/squad');
    revalidatePath('/academy');

    return {
      success:        true,
      player:         insertedPlayer as Player,
      academy_bonus:  (academyLevel - 1) * 2,
      perk_granted,
    };

  } catch (error: any) {
    console.error('Youth Scouting error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during scouting.' };
  }
}

export async function signYouthIntake(intakeId: string): Promise<ScoutResult> {
  try {
    const cookieStore = await cookies();
    const tgUserId = (await verifySession());
    if (!tgUserId) return { success: false, error: 'Unauthorized' };

    const { data: teamData } = await supabaseAdmin.from('teams').select('id').eq('user_id', tgUserId).single();
    if (!teamData) return { success: false, error: 'Team not found' };

    const { data: intake } = await supabaseAdmin.from('youth_intakes').select('*').eq('id', intakeId).eq('team_id', teamData.id).single();
    if (!intake) return { success: false, error: 'Intake not found' };

    const { data: user } = await supabaseAdmin.from('users').select('balance_fancoins').eq('id', tgUserId).single();
    const cost = 2000;
    if (!user || (user.balance_fancoins || 0) < cost) return { success: false, error: `Need ${cost} FC to sign youth.` };

    // Deduct FC via atomic RPC
    const { error: deductErr } = await supabaseAdmin.rpc('deduct_fancoins', {
      user_id: tgUserId,
      amount: cost,
    });

    if (deductErr) return { success: false, error: 'Insufficient FanCoins or deduction failed' };

    // Insert player as youth
    const { data: newPlayer, error } = await supabaseAdmin.from('players').insert({
      team_id: teamData.id,
      name: intake.name,
      age: intake.age,
      position: intake.position,
      ovr: intake.ovr,
      potential_limit: intake.potential_limit,
      stats: intake.stats,
      traits: intake.traits,
      lineup_status: 'bench',
      stamina: 100,
      morale: 80,
      is_nft_coach: false,
      is_youth: true,
      training_focus: 'balanced',
      youth_joined_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
       // Refund on failure
       await supabaseAdmin.rpc('increment_fancoins', { u_id: tgUserId, amount: cost });
       return { success: false, error: 'Failed to sign' };
    }

    // Delete intake
    await supabaseAdmin.from('youth_intakes').delete().eq('id', intakeId);

    // Track youth promotion achievement
    await triggerScoutingAchievements(teamData.id);

    revalidatePath('/academy');
    revalidatePath('/squad');

    return { success: true, player: newPlayer as Player };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// QUERY: getNextOpponentData
//
// Returns opponent info filtered by the user's Scout level (Fog of War):
//
//   scout_level 1-2: Only total OVR (squad is hidden)
//   scout_level 3-4: Names + formation visible; stats and perks hidden
//   scout_level 5+ : Full access — stats and perks visible
// ─────────────────────────────────────────────────────────────────────────────

export type FogOfWarLevel = 'hidden' | 'partial' | 'full';

export interface OpponentData {
  team_id:       string;
  team_name:     string;
  avg_ovr:       number;
  fog_level:     FogOfWarLevel;
  scout_level:   number;
  players?:      Array<{
    name:       string;
    position:   string;
    ovr?:       number;
    stats?:     Record<string, number>;
    traits?:    string[];
  }>;
}

export async function getNextOpponentData(
  userId: string
): Promise<{ success: boolean; data?: OpponentData; error?: string }> {
  try {
    // 1. Get user's team
    const { data: myTeam, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teamErr || !myTeam) return { success: false, error: 'Team not found.' };

    // 2. Get scout level
    const { data: infra } = await supabaseAdmin
      .from('infrastructure')
      .select('scout_level')
      .eq('team_id', myTeam.id)
      .maybeSingle();

    const scoutLevel: number = infra?.scout_level ?? 1;

    // 3. Find next pending match
    const { data: match } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id')
      .eq('status', 'pending')
      .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!match) return { success: false, error: 'No upcoming match found.' };

    const opponentTeamId = match.home_team_id === myTeam.id
      ? match.away_team_id
      : match.home_team_id;

    // 4. Get opponent team name
    const { data: oppTeam } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('id', opponentTeamId)
      .single();

    if (!oppTeam) return { success: false, error: 'Opponent team not found.' };

    // 5. Get opponent players
    const { data: oppPlayers } = await supabaseAdmin
      .from('players')
      .select('name, position, ovr, stats, traits')
      .eq('team_id', opponentTeamId)
      .order('ovr', { ascending: false });

    const players = oppPlayers ?? [];
    const avgOvr  = players.length
      ? Math.round(players.reduce((s, p) => s + (p.ovr || 0), 0) / players.length)
      : 0;

    // 6. Apply Fog of War based on scout level
    let fogLevel: FogOfWarLevel;
    let visiblePlayers: OpponentData['players'];

    if (scoutLevel <= 2) {
      // Fog: only OVR visible
      fogLevel       = 'hidden';
      visiblePlayers = undefined;
    } else if (scoutLevel <= 4) {
      // Partial: names + position, no stats/traits
      fogLevel       = 'partial';
      visiblePlayers = players.map(p => ({
        name:     p.name,
        position: p.position,
      }));
    } else {
      // Full: everything visible
      fogLevel       = 'full';
      visiblePlayers = players.map(p => ({
        name:     p.name,
        position: p.position,
        ovr:      p.ovr,
        stats:    p.stats,
        traits:   p.traits,
      }));
    }

    return {
      success: true,
      data: {
        team_id:     oppTeam.id,
        team_name:   oppTeam.name,
        avg_ovr:     avgOvr,
        fog_level:   fogLevel,
        scout_level: scoutLevel,
        players:     visiblePlayers,
      },
    };

  } catch (err: any) {
    console.error('[getNextOpponentData] Error:', err);
    return { success: false, error: err.message ?? 'Failed to fetch opponent data.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADUATE YOUTH — move player from youth roster to senior squad
// ─────────────────────────────────────────────────────────────────────────────

export async function graduateYouthAction(playerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await verifySession();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, is_youth, age')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (!player) return { success: false, error: 'Player not found' };
    if (!player.is_youth) return { success: false, error: 'Player is not in youth roster' };
    if (player.age < 17) return { success: false, error: 'Player must be at least 17 years old to graduate' };

    const { error } = await supabaseAdmin
      .from('players')
      .update({ is_youth: false, youth_joined_at: null })
      .eq('id', playerId);

    if (error) throw error;

    revalidatePath('/academy');
    revalidatePath('/squad');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to graduate youth player' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SET TRAINING FOCUS — change youth player's training focus
// ─────────────────────────────────────────────────────────────────────────────

export async function setTrainingFocusAction(
  playerId: string,
  focus: 'cardio' | 'strength' | 'ball' | 'balanced'
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await verifySession();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('user_id', userId).single();
    if (!team) return { success: false, error: 'Team not found' };

    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, is_youth')
      .eq('id', playerId)
      .eq('team_id', team.id)
      .single();

    if (!player) return { success: false, error: 'Player not found' };
    if (!player.is_youth) return { success: false, error: 'Can only set training focus for youth players' };

    const { error } = await supabaseAdmin
      .from('players')
      .update({ training_focus: focus })
      .eq('id', playerId);

    if (error) throw error;

    revalidatePath('/academy');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to set training focus' };
  }
}
