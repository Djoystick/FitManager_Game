'use server';

import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TournamentData {
  id: string;
  name: string;
  status: string;
  tier: number;
  created_at: string;
}

export interface TournamentMatchData {
  id: string;
  round: string;
  match_order: number;
  team_home: string | null;
  team_away: string | null;
  score_home: number | null;
  score_away: number | null;
  penalty_home: number | null;
  penalty_away: number | null;
  status: string;
  team_home_name?: string;
  team_away_name?: string;
}

export async function getActiveTournament(): Promise<{ success: boolean; data?: TournamentData; error?: string }> {
  try {
    const { data: tournament, error } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .in('status', ['registration', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !tournament) {
      return { success: false, error: 'No active tournament' };
    }

    return { success: true, data: tournament };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getTournamentBracket(tournamentId: string): Promise<{ success: boolean; data?: TournamentMatchData[]; error?: string }> {
  try {
    const { data: matches, error } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('match_order', { ascending: true });

    if (error || !matches) {
      return { success: false, error: 'Failed to fetch tournament matches' };
    }

    // Fetch team names
    const teamIds = new Set<string>();
    matches.forEach(m => {
      if (m.team_home) teamIds.add(m.team_home);
      if (m.team_away) teamIds.add(m.team_away);
    });

    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', Array.from(teamIds));

    const teamNames: Record<string, string> = {};
    if (teamsData) {
      teamsData.forEach(t => { teamNames[t.id] = t.name; });
    }

    const enriched = matches.map(m => ({
      ...m,
      team_home_name: m.team_home ? teamNames[m.team_home] || 'TBD' : 'TBD',
      team_away_name: m.team_away ? teamNames[m.team_away] || 'TBD' : 'TBD',
    }));

    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function joinTournament(tournamentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!team) return { success: false, error: 'Team not found' };

    // Check tournament exists and is in registration
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .single();

    if (!tournament || tournament.status !== 'registration') {
      return { success: false, error: 'Tournament not accepting registrations' };
    }

    // Check if already joined
    const { data: existing } = await supabaseAdmin
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('team_id', team.id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Already joined this tournament' };
    }

    // E1: Check tournament entry fee (2500 FC)
    const TOURNAMENT_ENTRY_FEE = 2500;
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('balance_fancoins')
      .eq('id', userId)
      .maybeSingle();

    if (!userData || (userData.balance_fancoins ?? 0) < TOURNAMENT_ENTRY_FEE) {
      return { success: false, error: `Insufficient FC. Tournament entry fee: ${TOURNAMENT_ENTRY_FEE} FC` };
    }

    // Deduct entry fee atomically
    const { error: feeError } = await supabaseAdmin.rpc('update_fancoins_after_match', {
      p_user_id: userId,
      p_salary: TOURNAMENT_ENTRY_FEE,
      p_reward: 0
    });

    if (feeError) {
      console.error('[joinTournament] Entry fee deduction error:', feeError);
      return { success: false, error: 'Failed to deduct entry fee' };
    }

    // Join
    const { error } = await supabaseAdmin.from('tournament_participants').insert({
      tournament_id: tournamentId,
      team_id: team.id,
    });

    if (error) throw error;

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function startTournament(tournamentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const userId = (await verifySession());
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Check tournament exists and is in registration
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .eq('status', 'registration')
      .single();

    if (!tournament) return { success: false, error: 'Tournament not found or already started' };

    // Get participants
    const { data: participants } = await supabaseAdmin
      .from('tournament_participants')
      .select('team_id')
      .eq('tournament_id', tournamentId);

    if (!participants || participants.length < 4) {
      return { success: false, error: 'Need at least 4 teams to start' };
    }

    // Shuffle participants
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Create round of 16 matches (or quarter finals if < 16)
    const numTeams = shuffled.length;
    const roundName = numTeams <= 4 ? 'semi_final' : 'round_of_16';
    const matchesPerRound = Math.floor(numTeams / 2);

    for (let i = 0; i < matchesPerRound; i++) {
      await supabaseAdmin.from('tournament_matches').insert({
        tournament_id: tournamentId,
        round: roundName,
        match_order: i,
        team_home: shuffled[i * 2].team_id,
        team_away: shuffled[i * 2 + 1].team_id,
        status: 'pending'
      });
    }

    // Update tournament status
    await supabaseAdmin
      .from('tournaments')
      .update({ status: 'active' })
      .eq('id', tournamentId);

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function isTeamInTournament(tournamentId: string, teamId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('team_id', teamId)
    .maybeSingle();

  return !!data;
}
