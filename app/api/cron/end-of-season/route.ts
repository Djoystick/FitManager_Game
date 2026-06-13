import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(telegramId: string, message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'Markdown' })
    });
  } catch (err) {
    console.error('[end-of-season] Telegram send error:', err);
  }
}

async function calculateSeasonAwards(instanceId: string, supabase: SupabaseClient) {
  console.log(`[SeasonAwards] Calculating awards for instance ${instanceId}...`);

  // Get all matches for this instance
  const { data: matches } = await supabase
    .from('league_matches')
    .select('id')
    .eq('league_instance_id', instanceId)
    .eq('is_played', true);

  if (!matches || matches.length === 0) return;

  const matchIds = matches.map(m => m.id);

  // Golden Boot: Top scorer
  const { data: goalScorers } = await supabase
    .from('match_events')
    .select('player_id, team_id')
    .in('match_id', matchIds)
    .eq('type', 'goal');

  if (goalScorers && goalScorers.length > 0) {
    const goalCounts: Record<string, { count: number; team_id: string }> = {};
    for (const event of goalScorers) {
      if (!goalCounts[event.player_id]) {
        goalCounts[event.player_id] = { count: 0, team_id: event.team_id };
      }
      goalCounts[event.player_id].count++;
    }

    const topScorer = Object.entries(goalCounts)
      .sort(([, a], [, b]) => b.count - a.count)[0];

    if (topScorer) {
      const [playerId, data] = topScorer;
      const { data: teamData } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', data.team_id)
        .maybeSingle();

      if (teamData?.user_id) {
        // Award 200 SP
        const { data: userData } = await supabase
          .from('users')
          .select('balance_fancoins')
          .eq('id', teamData.user_id)
          .maybeSingle();

        await supabase
          .from('users')
          .update({ balance_fancoins: (userData?.balance_fancoins ?? 0) + 200 })
          .eq('id', teamData.user_id);

        // Add trait to player
        const { data: playerData } = await supabase
          .from('players')
          .select('traits')
          .eq('id', playerId)
          .maybeSingle();

        const currentTraits = Array.isArray(playerData?.traits) ? playerData.traits : [];
        if (!currentTraits.includes('SEASON_AWARD_WINNER')) {
          await supabase
            .from('players')
            .update({ traits: [...currentTraits, 'SEASON_AWARD_WINNER'] })
            .eq('id', playerId);
        }

        // Record award
        await supabase.from('season_awards').upsert({
          season_id: instanceId,
          award_type: 'GOLDEN_BOOT',
          player_id: playerId,
          team_id: data.team_id,
          user_id: teamData.user_id,
        }, { onConflict: 'season_id, award_type' });

        console.log(`[SeasonAwards] Golden Boot: player ${playerId} (${data.count} goals)`);
      }
    }
  }

  // Golden Glove: Fewest goals conceded (team with best defensive record)
  const { data: standings } = await supabase
    .from('league_standings')
    .select('team_id, goals_against')
    .eq('league_instance_id', instanceId)
    .order('goals_against', { ascending: true })
    .limit(1);

  if (standings && standings.length > 0) {
    const bestDefense = standings[0];
    const { data: teamData } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', bestDefense.team_id)
      .maybeSingle();

    if (teamData?.user_id) {
      // Award 200 SP
      const { data: userData } = await supabase
        .from('users')
        .select('balance_fancoins')
        .eq('id', teamData.user_id)
        .maybeSingle();

      await supabase
        .from('users')
        .update({ balance_fancoins: (userData?.balance_fancoins ?? 0) + 200 })
        .eq('id', teamData.user_id);

      // Find the team's goalkeeper
      const { data: gk } = await supabase
        .from('players')
        .select('id, traits')
        .eq('team_id', bestDefense.team_id)
        .eq('position', 'GK')
        .limit(1)
        .maybeSingle();

      if (gk) {
        const currentTraits = Array.isArray(gk.traits) ? gk.traits : [];
        if (!currentTraits.includes('SEASON_AWARD_WINNER')) {
          await supabase
            .from('players')
            .update({ traits: [...currentTraits, 'SEASON_AWARD_WINNER'] })
            .eq('id', gk.id);
        }

        await supabase.from('season_awards').upsert({
          season_id: instanceId,
          award_type: 'GOLDEN_GLOVE',
          player_id: gk.id,
          team_id: bestDefense.team_id,
          user_id: teamData.user_id,
        }, { onConflict: 'season_id, award_type' });

        console.log(`[SeasonAwards] Golden Glove: GK ${gk.id} (${bestDefense.goals_against} GA)`);
      }
    }
  }

  console.log(`[SeasonAwards] Awards calculation complete for instance ${instanceId}`);
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('[end-of-season] Unauthorized cron attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON EndOfSeason] Starting...');

    // 1. Find all active instances
    // We limit this to 3 per run so we don't hit the Vercel 10s Serverless timeout
    const { data: activeInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id, tier_level, status')
      .in('status', ['active', 'finishing'])
      .limit(3);

    if (!activeInstances || activeInstances.length === 0) {
      return NextResponse.json({ message: 'No active instances' });
    }

    let processedCount = 0;

    for (const instance of activeInstances) {
      // Check if all matches for this instance are played
      const { count: unplayedCount } = await supabaseAdmin
        .from('league_matches')
        .select('*', { count: 'exact', head: true })
        .eq('league_instance_id', instance.id)
        .eq('is_played', false);

      if (unplayedCount !== null && unplayedCount > 0) {
        continue; // Season not finished yet
      }

      // ── R2 FIX: CAS (Compare-And-Swap) lock via intermediate 'finishing' status ──
      // If the instance is already 'finishing', we assume it was interrupted and resume it.
      let claimedId = instance.id;
      if (instance.status === 'active') {
        const { data: claimed, error: lockError } = await supabaseAdmin
          .from('league_instances')
          .update({ status: 'finishing' })
          .eq('id', instance.id)
          .eq('status', 'active')  // CAS condition: only update if still 'active'
          .select('id')
          .maybeSingle();

        if (lockError) {
          console.error(`[CRON EndOfSeason] Lock error for instance ${instance.id}:`, lockError);
          continue;
        }
        if (!claimed) {
          console.log(`[CRON EndOfSeason] Instance ${instance.id} already claimed by another process — skipping.`);
          continue;
        }
      }

      console.log(`[CRON EndOfSeason] Instance ${instance.id} claimed. Processing Tier ${instance.tier_level}...`);

      // Get final standings
      const { data: finalStandings } = await supabaseAdmin
        .from('league_standings')
        .select('team_id, points, goals_for, goals_against, season_reward_paid')
        .eq('league_instance_id', instance.id)
        .order('points', { ascending: false })
        .order('goals_for', { ascending: false });

      if (!finalStandings || finalStandings.length === 0) {
        // Nothing to process — mark as finished and continue
        await supabaseAdmin
          .from('league_instances')
          .update({ status: 'finished' })
          .eq('id', instance.id);
        continue;
      }

      // ── R5 FIX: Read Treasury once per instance (fresh read after CAS lock) ──
      // Each iteration reads a fresh value so sequential league processing
      // doesn't accumulate stale snapshot errors.
      const { data: treasuryData } = await supabaseAdmin
        .from('treasury')
        .select('prize_pool_ton')
        .eq('id', 1)
        .single();
      const currentPool = treasuryData?.prize_pool_ton ?? 0;

      let drainPercentage = 0;
      const t = instance.tier_level;
      if (t === 1)            drainPercentage = 0.10;
      else if (t === 2)       drainPercentage = 0.04;
      else if (t === 3)       drainPercentage = 0.02;
      else if (t === 4)       drainPercentage = 0.01;
      else if (t === 5)       drainPercentage = 0.005;
      else if (t === 6 || t === 7) drainPercentage = 0.001;
      else                    drainPercentage = 0; // Tiers 8-10: no TON drain

      const instancePrizeTon = currentPool * drainPercentage;
      let usedTon = 0;

      // ── REASSIGNMENTS AND PRIZES ────────────────────────────────────────────
      const newAssignments: { team_id: string; new_tier: number }[] = [];

      for (let i = 0; i < finalStandings.length; i++) {
        let nextTier = instance.tier_level;
        const position = i + 1;

        if (i < 3) nextTier = Math.max(1, instance.tier_level - 1);          // Top 3 → promoted
        else if (i >= finalStandings.length - 3) nextTier = Math.min(10, instance.tier_level + 1); // Bottom 3 → relegated

        const { data: teamData } = await supabaseAdmin
          .from('teams')
          .select('id, user_id, name')
          .eq('id', finalStandings[i].team_id)
          .single();

        let isRealUser = false;
        let userData: any = null;

        if (teamData?.user_id) {
          const { data: ud } = await supabaseAdmin
            .from('users')
            .select('telegram_id, balance_ton, balance_fancoins')
            .eq('id', teamData.user_id)
            .single();
          userData = ud;

          if (userData && !userData.telegram_id.startsWith('bot_')) {
            isRealUser = true;
          }
        }

        // Only migrate REAL users to the next season. Bots stay in the finished instance and "retire".
        if (isRealUser) {
          newAssignments.push({ team_id: finalStandings[i].team_id, new_tier: nextTier });
        }

        // ── R5 FIX: Skip if prizes already paid (idempotency guard) ──────────
        if (finalStandings[i].season_reward_paid) {
          console.log(`[CRON EndOfSeason] Team ${finalStandings[i].team_id} already rewarded — skipping.`);
          continue;
        }

        if (isRealUser && userData && teamData) {
          let tonWon = 0;
          let fcWon = 0;

          if (i === 0)      tonWon = instancePrizeTon * 0.50; // 1st Place
          else if (i === 1) tonWon = instancePrizeTon * 0.30; // 2nd Place
          else if (i === 2) tonWon = instancePrizeTon * 0.20; // 3rd Place

          // FC reward (scales inversely with tier — higher tiers earn more base FC)
          // E1: SEASON_PAYOUT_MULT = 0.55 (45% reduction)
          const SEASON_PAYOUT_MULT = 0.55;
          if (position === 1)      fcWon = Math.floor((15000 + ((11 - t) * 2000)) * SEASON_PAYOUT_MULT);
          else if (position <= 3)  fcWon = Math.floor((10000 + ((11 - t) * 1500)) * SEASON_PAYOUT_MULT);
          else                     fcWon = Math.floor((3000  + ((11 - t) * 500))  * SEASON_PAYOUT_MULT);

          const newTon = (userData?.balance_ton || 0) + tonWon;
          const newFc  = (userData?.balance_fancoins || 0) + fcWon;

          await supabaseAdmin
            .from('users')
            .update({ balance_ton: newTon, balance_fancoins: newFc })
            .eq('id', teamData.user_id);

          if (tonWon > 0) {
            usedTon += tonWon;
          }

          // ── R5 FIX: Mark this standing as paid (prevents double-payout on retry) ──
          await supabaseAdmin
            .from('league_standings')
            .update({ season_reward_paid: true })
            .eq('team_id', finalStandings[i].team_id)
            .eq('league_instance_id', instance.id);

          // ── YOUTH ACADEMY INTAKE ────────────────────────────────────────────
          const { data: infra } = await supabaseAdmin
            .from('infrastructure')
            .select('academy_level, scout_level, academy_perks')
            .eq('team_id', teamData.id)
            .maybeSingle();
            
          const academyLevel = infra?.academy_level ?? 1;
          const scoutLevel = infra?.scout_level ?? 1;
          const academyPerks = infra?.academy_perks ?? [];

          // Generate 1-3 youth players
          const numIntakes = Math.floor(Math.random() * 3) + 1;
          const { generateRandomPlayer } = await import('@/app/actions/scoutingActions');
          const intakes = [];
          for (let y = 0; y < numIntakes; y++) {
            const { perk_granted, lineup_status, is_nft_coach, morale, ...newPlayerData } = generateRandomPlayer(teamData.id, academyLevel, scoutLevel, academyPerks);
            intakes.push({
              team_id: teamData.id,
              name: newPlayerData.name,
              age: newPlayerData.age,
              position: newPlayerData.position,
              ovr: newPlayerData.ovr,
              potential_limit: newPlayerData.potential_limit,
              stats: newPlayerData.stats,
              traits: newPlayerData.traits || [],
            });
          }
          await supabaseAdmin.from('youth_intakes').insert(intakes);

          const { checkAndUnlockAchievement } = await import('@/app/services/achievementService');
          if (position === 1) await checkAndUnlockAchievement(teamData.id, 'LEAGUE_CHAMP');
          if (nextTier < instance.tier_level) await checkAndUnlockAchievement(teamData.id, 'PROMOTION');
          if (nextTier === 1) await checkAndUnlockAchievement(teamData.id, 'TOP_LEAGUE');

          if (userData?.telegram_id) {
            let msg = `🏆 *Сезон завершен!*\n\nТвоя команда *${teamData.name}* заняла *${position} место* в Tier ${instance.tier_level}.\n`;
            if (tonWon > 0) msg += `💰 Призовые TON: *+${tonWon.toFixed(4)} TON*\n`;
            msg += `🪙 Призовые FC: *+${fcWon} FC*\n\n`;

            if (nextTier < instance.tier_level)      msg += `🚀 *Поздравляем с выходом в Tier ${nextTier}!*`;
            else if (nextTier > instance.tier_level) msg += `📉 К сожалению, ты вылетаешь в Tier ${nextTier}.`;
            else                                     msg += `👉 В следующем сезоне ты остаешься в Tier ${nextTier}.`;

            await sendTelegramMessage(userData.telegram_id, msg);
          }
        }
      }

      // ── E1: WEALTH TAX (Board Dividends) ──────────────────────────────────────
      // Maintenance Tax is now player-driven via Infrastructure Report modal.
      // Only Wealth Tax is deducted automatically at season end.
      const WEALTH_TAX_RATE = 0.06;

      for (let i = 0; i < finalStandings.length; i++) {
        const { data: teamData } = await supabaseAdmin
          .from('teams')
          .select('id, user_id, name')
          .eq('id', finalStandings[i].team_id)
          .single();

        if (!teamData?.user_id) continue;

        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('telegram_id, balance_fancoins')
          .eq('id', teamData.user_id)
          .maybeSingle();

        if (!userData || userData.telegram_id?.startsWith('bot_')) continue;

        // Wealth Tax = currentBalance × WEALTH_TAX_RATE
        const currentBalance = userData.balance_fancoins ?? 0;
        const wealthTax = Math.floor(currentBalance * WEALTH_TAX_RATE);

        if (wealthTax > 0) {
          // Deduct wealth tax via atomic RPC
          const { error: taxError } = await supabaseAdmin.rpc('update_fancoins_after_match', {
            p_user_id: teamData.user_id,
            p_salary: wealthTax,
            p_reward: 0
          });

          if (taxError) {
            console.error(`[CRON EndOfSeason] Wealth tax deduction error for ${teamData.name}:`, taxError);
          } else {
            console.log(
              `[CRON EndOfSeason] Wealth tax for ${teamData.name}: ${wealthTax} FC`
            );
          }

          // E2: Send Board Dividends notification via Telegram
          if (userData.telegram_id) {
            const netProfit = Math.floor(wealthTax / 0.06 * 0.94); // approximate net profit
            const reserveFund = 500;
            let dividendsMsg = `🏛️ *Отчёт Совета Директоров*\n\n`;
            dividendsMsg += `📊 Финансовые показатели сезона:\n`;
            dividendsMsg += `• Чистая прибыль: *+${netProfit.toLocaleString()} FC*\n`;
            dividendsMsg += `• Дивиденды Совета (6%): *-${wealthTax.toLocaleString()} FC*\n`;
            dividendsMsg += `• Резервный фонд: *+${reserveFund} FC*\n\n`;
            dividendsMsg += `_«Совет директоров благодарит за стабильный рост клуба. Часть прибыли направлена на развитие инфраструктуры.»_`;
            await sendTelegramMessage(userData.telegram_id, dividendsMsg);
          }
        }
      }

      // ── R2/R5 FIX: Atomic Treasury deduction via RPC (no read-modify-write race) ──
      if (usedTon > 0) {
        const { error: drainError } = await supabaseAdmin.rpc('safe_deduct_treasury', {
          deduct_amount: usedTon
        });
        if (drainError) {
          console.error(`[CRON EndOfSeason] Treasury drain RPC error for Tier ${instance.tier_level}:`, drainError);
        } else {
          console.log(`[CRON EndOfSeason] Deducted ${usedTon.toFixed(4)} TON from Treasury for Tier ${instance.tier_level}.`);
        }
      }

      // ── Assign teams to new tier instances for next season ─────────────────
      for (const assignment of newAssignments) {
        let targetInstanceId: string | undefined;

        const { data: openInstances } = await supabaseAdmin
          .from('league_instances')
          .select('id')
          .eq('tier_level', assignment.new_tier)
          .eq('status', 'filling')
          .order('created_at', { ascending: true })
          .limit(1);

        if (openInstances && openInstances.length > 0) {
          targetInstanceId = openInstances[0].id;
        } else {
          const { data: newInstance } = await supabaseAdmin
            .from('league_instances')
            .insert({
              tier_level: assignment.new_tier,
              name: `Sector ${Math.floor(Math.random() * 900) + 100}`,
              status: 'filling'
            })
            .select('id')
            .single();
          targetInstanceId = newInstance!.id;
        }

        await supabaseAdmin.from('league_standings').upsert({
          team_id: assignment.team_id,
          league_instance_id: targetInstanceId,
          points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0,
          season_reward_paid: false // reset for the new season
        }, { onConflict: 'team_id, league_instance_id' });
      }

      // ── CALCULATE SEASON AWARDS ─────────────────────────────────────────────
      try {
        await calculateSeasonAwards(instance.id, supabaseAdmin);
      } catch (awardError) {
        console.error(`[CRON EndOfSeason] Award calculation failed for instance ${instance.id}:`, awardError);
      }

      // ── Mark instance as fully finished ────────────────────────────────────
      await supabaseAdmin
        .from('league_instances')
        .update({ status: 'finished' })
        .eq('id', instance.id);

      processedCount++;
      console.log(`[CRON EndOfSeason] Instance ${instance.id} fully processed and marked 'finished'.`);
    }

    return NextResponse.json({ message: `Successfully processed ${processedCount} instances.` });
  } catch (error: any) {
    console.error('[CRON EndOfSeason] CRITICAL ERROR:', error);
    try {
      const { Logger } = await import('@/lib/logger');
      Logger.critical('cron:end-of-season', error.message, { stack: error.stack });
    } catch(e) {}
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
