import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('[end-of-season] Unauthorized cron attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON EndOfSeason] Starting...');

    // 1. Find all active instances
    const { data: activeInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id, tier_level')
      .eq('status', 'active');

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
      // We attempt to atomically transition status active → finishing.
      // If another cron process already claimed this instance, the UPDATE will
      // match 0 rows (status is no longer 'active') and we skip it.
      // This prevents double-processing and double-payouts in concurrent runs.
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

        newAssignments.push({ team_id: finalStandings[i].team_id, new_tier: nextTier });

        // ── R5 FIX: Skip if prizes already paid (idempotency guard) ──────────
        if (finalStandings[i].season_reward_paid) {
          console.log(`[CRON EndOfSeason] Team ${finalStandings[i].team_id} already rewarded — skipping.`);
          continue;
        }

        const { data: teamData } = await supabaseAdmin
          .from('teams')
          .select('user_id, name')
          .eq('id', finalStandings[i].team_id)
          .single();

        if (teamData?.user_id) {
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('telegram_id, balance_ton, balance_fancoins')
            .eq('id', teamData.user_id)
            .single();

          let tonWon = 0;
          let fcWon = 0;

          if (i === 0)      tonWon = instancePrizeTon * 0.50; // 1st Place
          else if (i === 1) tonWon = instancePrizeTon * 0.30; // 2nd Place
          else if (i === 2) tonWon = instancePrizeTon * 0.20; // 3rd Place

          // FC reward (scales inversely with tier — higher tiers earn more base FC)
          if (position === 1)      fcWon = 15000 + ((11 - t) * 2000);
          else if (position <= 3)  fcWon = 10000 + ((11 - t) * 1500);
          else                     fcWon = 3000  + ((11 - t) * 500);

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

        await supabaseAdmin.from('league_standings').insert({
          team_id: assignment.team_id,
          league_instance_id: targetInstanceId,
          points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0,
          season_reward_paid: false // reset for the new season
        });
      }

      // ── Mark instance as fully finished ────────────────────────────────────
      await supabaseAdmin
        .from('league_instances')
        .update({ status: 'finished' })
        .eq('id', instance.id);

      processedCount++;
      console.log(`[CRON EndOfSeason] Instance ${instance.id} fully processed and marked 'finished'.`);
    }

    return NextResponse.json({ message: 'EndOfSeason processed', processed: processedCount });
  } catch (error: any) {
    console.error('[end-of-season] Unhandled error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
