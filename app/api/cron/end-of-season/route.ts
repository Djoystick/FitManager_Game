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
      console.warn("Unauthorized cron attempt");
    }

    console.log("[CRON EndOfSeason] Starting...");

    // 1. Find all active instances
    const { data: activeInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id, tier_level')
      .eq('status', 'active');

    if (!activeInstances || activeInstances.length === 0) {
      return NextResponse.json({ message: "No active instances" });
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

      console.log(`[CRON EndOfSeason] Instance ${instance.id} is finished! Processing...`);
      
      // Get final standings
      const { data: finalStandings } = await supabaseAdmin
        .from('league_standings')
        .select('team_id, points, goals_for, goals_against')
        .eq('league_instance_id', instance.id)
        .order('points', { ascending: false })
        .order('goals_for', { ascending: false });

      if (!finalStandings || finalStandings.length === 0) continue;

      // Mark instance as finished
      await supabaseAdmin
        .from('league_instances')
        .update({ status: 'finished' })
        .eq('id', instance.id);

      // --- PRIZE WATERFALL (Asynchronous Treasury Drain) ---
      const { data: treasuryData } = await supabaseAdmin.from('treasury').select('prize_pool_ton').eq('id', 1).single();
      const currentPool = treasuryData?.prize_pool_ton || 0;
      
      let drainPercentage = 0;
      const t = instance.tier_level;
      if (t === 1) drainPercentage = 0.10;
      else if (t === 2) drainPercentage = 0.04;
      else if (t === 3) drainPercentage = 0.02;
      else if (t === 4) drainPercentage = 0.01;
      else if (t === 5) drainPercentage = 0.005;
      else if (t === 6 || t === 7) drainPercentage = 0.001;
      else drainPercentage = 0; // Tiers 8-10
      
      const instancePrizeTon = currentPool * drainPercentage;
      let usedTon = 0;

      // --- REASSIGNMENTS AND PRIZES ---
      const newAssignments: { team_id: string, new_tier: number }[] = [];
      
      for (let i = 0; i < finalStandings.length; i++) {
        let nextTier = instance.tier_level;
        let position = i + 1;
        
        if (i < 3) nextTier = Math.max(1, instance.tier_level - 1); // Top 3
        else if (i >= finalStandings.length - 3) nextTier = Math.min(10, instance.tier_level + 1); // Bottom 3 -> max Tier 10
        
        newAssignments.push({
          team_id: finalStandings[i].team_id,
          new_tier: nextTier
        });

        // Distribute Prizes
        const { data: teamData } = await supabaseAdmin.from('teams').select('user_id, name').eq('id', finalStandings[i].team_id).single();
        if (teamData?.user_id) {
          const { data: userData } = await supabaseAdmin.from('users').select('telegram_id, balance_ton, balance_fancoins').eq('id', teamData.user_id).single();
          
          let tonWon = 0;
          let fcWon = 0;
          
          if (i === 0) tonWon = instancePrizeTon * 0.50; // 1st Place
          else if (i === 1) tonWon = instancePrizeTon * 0.30; // 2nd Place
          else if (i === 2) tonWon = instancePrizeTon * 0.20; // 3rd Place
          
          // FC reward
          if (position === 1) fcWon = 15000 + ((11 - t) * 2000);
          else if (position <= 3) fcWon = 10000 + ((11 - t) * 1500);
          else fcWon = 3000 + ((11 - t) * 500);
          
          const newTon = (userData?.balance_ton || 0) + tonWon;
          const newFc = (userData?.balance_fancoins || 0) + fcWon;
          
          await supabaseAdmin.from('users')
            .update({ balance_ton: newTon, balance_fancoins: newFc })
            .eq('id', teamData.user_id);

          if (tonWon > 0) {
            usedTon += tonWon;
          }

          if (userData?.telegram_id) {
            let msg = `🏆 *Сезон завершен!*\n\nТвоя команда *${teamData.name}* заняла *${position} место* в Tier ${instance.tier_level}.\n`;
            if (tonWon > 0) msg += `💰 Призовые TON: *+${tonWon.toFixed(4)} TON*\n`;
            msg += `🪙 Призовые FC: *+${fcWon} FC*\n\n`;
            
            if (nextTier < instance.tier_level) msg += `🚀 *Поздравляем с выходом в Tier ${nextTier}!*`;
            else if (nextTier > instance.tier_level) msg += `📉 К сожалению, ты вылетаешь в Tier ${nextTier}.`;
            else msg += `👉 В следующем сезоне ты остаешься в Tier ${nextTier}.`;
            
            await sendTelegramMessage(userData.telegram_id, msg);
          }
        }
      }

      // Deduct from Treasury
      if (usedTon > 0) {
        const { data: currentTreasury } = await supabaseAdmin.from('treasury').select('prize_pool_ton').eq('id', 1).single();
        const safePool = currentTreasury?.prize_pool_ton || 0;
        await supabaseAdmin.from('treasury').update({ prize_pool_ton: Math.max(0, safePool - usedTon) }).eq('id', 1);
        console.log(`[CRON EndOfSeason] Deducted ${usedTon.toFixed(4)} TON from Treasury for Tier ${instance.tier_level}`);
      }

      // We need to put these teams into 'filling' instances of their new tiers
      for (const assignment of newAssignments) {
        let targetInstanceId;
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
          points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0
        });
      }
      processedCount++;
    }

    return NextResponse.json({ message: "EndOfSeason processed", processed: processedCount });
  } catch (error: any) {
    console.error("EndOfSeason error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
