'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { simulateMatch, MatchPlayer } from '@/app/utils/matchEngine';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// ISSUE CHALLENGE: Send a PvP challenge to another manager
// ============================================================
export async function issueChallenge(targetUserId: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    if (userId === targetUserId) {
      return { success: false, error: 'Cannot challenge yourself' };
    }

    // Check for existing pending challenge between these users
    const { data: existing } = await supabaseAdmin
      .from('pvp_challenges')
      .select('id')
      .or(`and(challenger_id.eq.${userId},opponent_id.eq.${targetUserId},status.eq.pending),and(challenger_id.eq.${targetUserId},opponent_id.eq.${userId},status.eq.pending)`)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'A pending challenge already exists with this manager' };
    }

    // Check daily limit (3 challenges per day per pair)
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabaseAdmin
      .from('pvp_challenges')
      .select('*', { count: 'exact', head: true })
      .or(`and(challenger_id.eq.${userId},opponent_id.eq.${targetUserId}),and(challenger_id.eq.${targetUserId},opponent_id.eq.${userId})`)
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count ?? 0) >= 3) {
      return { success: false, error: 'Daily challenge limit reached (3 per day)' };
    }

    // Create challenge
    const { data: challenge, error } = await supabaseAdmin
      .from('pvp_challenges')
      .insert({
        challenger_id: userId,
        opponent_id: targetUserId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Get challenger's team name for notification
    const { data: challengerTeam } = await supabaseAdmin
      .from('teams').select('name').eq('user_id', userId).maybeSingle();
    const challengerName = challengerTeam?.name ?? 'Someone';

    await supabaseAdmin.from('personal_notifications').insert({
      user_id: targetUserId,
      type: 'challenge',
      title: 'PvP Challenge',
      message: JSON.stringify({
        en: `${challengerName} challenged you to a PvP match!`,
        ru: `${challengerName} вызвал вас на PvP-матч!`,
      }),
    });

    return { success: true, challengeId: challenge.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to issue challenge' };
  }
}

// ============================================================
// RESOLVE CHALLENGE: Accept/decline and simulate if accepted
// ============================================================
export async function resolvePvPChallenge(challengeId: string, accept: boolean) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Fetch challenge
    const { data: challenge, error: fetchErr } = await supabaseAdmin
      .from('pvp_challenges')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    if (fetchErr || !challenge) return { success: false, error: 'Challenge not found' };
    if (challenge.opponent_id !== userId) return { success: false, error: 'Not authorized' };
    if (challenge.status !== 'pending') return { success: false, error: 'Challenge is no longer pending' };
    if (new Date(challenge.expires_at) < new Date()) {
      await supabaseAdmin.from('pvp_challenges').update({ status: 'declined' }).eq('id', challengeId);
      return { success: false, error: 'Challenge has expired' };
    }

    if (!accept) {
      await supabaseAdmin.from('pvp_challenges').update({ status: 'declined' }).eq('id', challengeId);

      // Notify challenger
      await supabaseAdmin.from('personal_notifications').insert({
        user_id: challenge.challenger_id,
        type: 'challenge',
        title: 'Challenge declined',
        message: JSON.stringify({
          en: 'Your PvP challenge was declined.',
          ru: 'Ваш PvP-вызов был отклонён.',
        }),
      });

      return { success: true };
    }

    // ── ACCEPT: Simulate the match ──────────────────────────────────
    const challengerTeamId = await getTeamId(challenge.challenger_id);
    const opponentTeamId = await getTeamId(challenge.opponent_id);

    if (!challengerTeamId || !opponentTeamId) {
      return { success: false, error: 'One of the teams could not be found' };
    }

    // Load squads
    const [homePlayersData, awayPlayersData] = await Promise.all([
      supabaseAdmin.from('players').select('*').eq('team_id', challengerTeamId),
      supabaseAdmin.from('players').select('*').eq('team_id', opponentTeamId),
    ]);

    const homePlayers = homePlayersData.data || [];
    const awayPlayers = awayPlayersData.data || [];

    // Build lineups
    const getSquad = (players: any[]) => {
      let starters = players.filter(
        p => p.lineup_slot !== null && parseInt(p.lineup_slot) <= 10 && !p.is_injured
      );
      let bench = players.filter(
        p => (p.lineup_status === 'bench' || p.lineup_status === 'reserve') && !p.is_injured
      );
      if (starters.length < 11) {
        const allHealthy = players.filter(p => !p.is_injured).sort((a: any, b: any) => (b.ovr || 0) - (a.ovr || 0));
        starters = allHealthy.slice(0, 11);
        bench = [];
      }
      return { starters, bench: bench.slice(0, 7) };
    };

    const homeSquad = getSquad(homePlayers);
    const awaySquad = getSquad(awayPlayers);

    const safeStats = (raw: any) => ({
      pace: Math.max(1, Math.min(99, Number(raw?.pace ?? 50) || 50)),
      shooting: Math.max(1, Math.min(99, Number(raw?.shooting ?? 50) || 50)),
      passing: Math.max(1, Math.min(99, Number(raw?.passing ?? 50) || 50)),
      dribbling: Math.max(1, Math.min(99, Number(raw?.dribbling ?? 50) || 50)),
      defending: Math.max(1, Math.min(99, Number(raw?.defending ?? 50) || 50)),
      physical: Math.max(1, Math.min(99, Number(raw?.physical ?? 50) || 50)),
    });

    const mapToMatchPlayer = (p: any): MatchPlayer => ({
      id: p.id,
      name: p.name ?? 'Unknown',
      position: p.position ?? 'MID',
      stats: safeStats(p.stats),
      stamina: Math.max(0, Math.min(100, Number(p.stamina ?? 70) || 70)),
      traits: Array.isArray(p.traits) ? p.traits : [],
    });

    const homeLineup = homeSquad.starters.map(mapToMatchPlayer);
    const awayLineup = awaySquad.starters.map(mapToMatchPlayer);
    const homeBench = homeSquad.bench.map(mapToMatchPlayer);
    const awayBench = awaySquad.bench.map(mapToMatchPlayer);

    // Get tactics
    const [homeTeamData, awayTeamData] = await Promise.all([
      supabaseAdmin.from('teams').select('tactic').eq('id', challengerTeamId).maybeSingle(),
      supabaseAdmin.from('teams').select('tactic').eq('id', opponentTeamId).maybeSingle(),
    ]);

    const result = simulateMatch(
      homeLineup, awayLineup, homeBench, awayBench,
      {}, {}, // green links (not tracked for PvP)
      (homeTeamData?.data?.tactic as any) || 'Balanced',
      (awayTeamData?.data?.tactic as any) || 'Balanced'
    );

    const homeScore = result.score.home;
    const awayScore = result.score.away;

    // Determine winner
    const challengerWon = homeScore > awayScore;
    const opponentWon = awayScore > homeScore;
    const draw = homeScore === awayScore;

    // Update challenge status
    const resultScore = `${homeScore}:${awayScore}`;
    await supabaseAdmin.from('pvp_challenges').update({
      status: 'completed',
      match_id: null, // PvP matches are not league matches
      result_score: resultScore,
    }).eq('id', challengeId);

    // ── Award rewards ──────────────────────────────────────────────
    // Challenger (home team): win=1000FC+50SP, draw=200FC+10SP, loss=200FC+0SP
    // Opponent (away team): win=1000FC+50SP, draw=200FC+10SP, loss=200FC+0SP
    const challengerReward = challengerWon
      ? { fc: 1000, sp: 50 }
      : draw
        ? { fc: 200, sp: 10 }
        : { fc: 200, sp: 0 };

    const opponentReward = opponentWon
      ? { fc: 1000, sp: 50 }
      : draw
        ? { fc: 200, sp: 10 }
        : { fc: 200, sp: 0 };

    // Award challenger
    await supabaseAdmin.rpc('increment_fancoins', { u_id: challenge.challenger_id, amount: challengerReward.fc });
    if (challengerReward.sp > 0) {
      const { data: cTeam } = await supabaseAdmin.from('teams').select('id').eq('user_id', challenge.challenger_id).maybeSingle();
      if (cTeam) {
        try { await supabaseAdmin.rpc('increment_sweat_points', { p_team_id: cTeam.id, p_amount: challengerReward.sp }); } catch {}
      }
    }

    // Award opponent
    await supabaseAdmin.rpc('increment_fancoins', { u_id: challenge.opponent_id, amount: opponentReward.fc });
    if (opponentReward.sp > 0) {
      const { data: oTeam } = await supabaseAdmin.from('teams').select('id').eq('user_id', challenge.opponent_id).maybeSingle();
      if (oTeam) {
        try { await supabaseAdmin.rpc('increment_sweat_points', { p_team_id: oTeam.id, p_amount: opponentReward.sp }); } catch {}
      }
    }

    // ── Send notifications ──────────────────────────────────────────
    const { data: challengerTeam } = await supabaseAdmin
      .from('teams').select('name').eq('user_id', challenge.challenger_id).maybeSingle();
    const { data: opponentTeam } = await supabaseAdmin
      .from('teams').select('name').eq('user_id', challenge.opponent_id).maybeSingle();

    const challengerName = challengerTeam?.name ?? 'Challenger';
    const opponentName = opponentTeam?.name ?? 'Opponent';

    // Notify challenger
    const challengerResult = challengerWon ? 'won' : draw ? 'drew' : 'lost';
    const challengerResultRu = challengerWon ? 'победил' : draw ? 'сыграл вничью' : 'проиграл';
    await supabaseAdmin.from('personal_notifications').insert({
      user_id: challenge.challenger_id,
      type: 'challenge',
      title: 'Challenge result',
      message: JSON.stringify({
        en: `You ${challengerResult} against ${opponentName}! Score: ${resultScore}. +${challengerReward.fc} FC${challengerReward.sp > 0 ? ` +${challengerReward.sp} SP` : ''}`,
        ru: `Вы ${challengerResultRu} против ${opponentName}! Счёт: ${resultScore}. +${challengerReward.fc} FC${challengerReward.sp > 0 ? ` +${challengerReward.sp} SP` : ''}`,
      }),
    });

    // Notify opponent
    const opponentResult = opponentWon ? 'won' : draw ? 'drew' : 'lost';
    const opponentResultRu = opponentWon ? 'победил' : draw ? 'сыграл вничью' : 'проиграл';
    await supabaseAdmin.from('personal_notifications').insert({
      user_id: challenge.opponent_id,
      type: 'challenge',
      title: 'Challenge result',
      message: JSON.stringify({
        en: `You ${opponentResult} against ${challengerName}! Score: ${resultScore}. +${opponentReward.fc} FC${opponentReward.sp > 0 ? ` +${opponentReward.sp} SP` : ''}`,
        ru: `Вы ${opponentResultRu} против ${challengerName}! Счёт: ${resultScore}. +${opponentReward.fc} FC${opponentReward.sp > 0 ? ` +${opponentReward.sp} SP` : ''}`,
      }),
    });

    return {
      success: true,
      result: {
        homeScore,
        awayScore,
        challengerWon,
        opponentWon,
        draw,
        challengerReward,
        opponentReward,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resolve challenge' };
  }
}

// ============================================================
// GET PENDING CHALLENGES: Incoming challenges for the user
// ============================================================
export async function getPendingChallenges() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: challenges, error } = await supabaseAdmin
      .from('pvp_challenges')
      .select('*')
      .eq('opponent_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!challenges || challenges.length === 0) {
      return { success: true, data: [] };
    }

    const challengerIds = challenges.map(c => c.challenger_id);
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('user_id, name, logo_url')
      .in('user_id', challengerIds);

    const teamMap: Record<string, { name: string; logo_url: string | null }> = {};
    teams?.forEach(t => {
      teamMap[t.user_id] = { name: t.name, logo_url: t.logo_url };
    });

    const enriched = challenges.map(c => ({
      challenge_id: c.id,
      challenger_id: c.challenger_id,
      challenger_name: teamMap[c.challenger_id]?.name ?? 'Unknown',
      challenger_logo: teamMap[c.challenger_id]?.logo_url ?? null,
      created_at: c.created_at,
      expires_at: c.expires_at,
    }));

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load challenges' };
  }
}

// ============================================================
// GET CHALLENGE HISTORY: Recent completed challenges
// ============================================================
export async function getChallengeHistory() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('tg_user_id')?.value;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { data: challenges, error } = await supabaseAdmin
      .from('pvp_challenges')
      .select('*')
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!challenges || challenges.length === 0) {
      return { success: true, data: [] };
    }

    const allUserIds = new Set<string>();
    challenges.forEach(c => {
      allUserIds.add(c.challenger_id);
      allUserIds.add(c.opponent_id);
    });

    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('user_id, name, logo_url')
      .in('user_id', Array.from(allUserIds));

    const teamMap: Record<string, { name: string; logo_url: string | null }> = {};
    teams?.forEach(t => {
      teamMap[t.user_id] = { name: t.name, logo_url: t.logo_url };
    });

    const enriched = challenges.map(c => {
      const isChallenger = c.challenger_id === userId;
      const opponentId = isChallenger ? c.opponent_id : c.challenger_id;
      const [homeScore, awayScore] = (c.result_score ?? '0:0').split(':').map(Number);
      const myScore = isChallenger ? homeScore : awayScore;
      const theirScore = isChallenger ? awayScore : homeScore;
      const result = myScore > theirScore ? 'win' : myScore < theirScore ? 'loss' : 'draw';

      return {
        challenge_id: c.id,
        opponent_name: teamMap[opponentId]?.name ?? 'Unknown',
        opponent_logo: teamMap[opponentId]?.logo_url ?? null,
        result,
        score: c.result_score,
        created_at: c.created_at,
      };
    });

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load history' };
  }
}

// ============================================================
// HELPER: Get team ID from user ID
// ============================================================
async function getTeamId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('teams').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}
