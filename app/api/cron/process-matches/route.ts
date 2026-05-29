import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveMatch } from '@/app/actions/matchActions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ─── Idempotency gate ────────────────────────────────────────────────────────
// How many minutes must pass since the last completed match before we allow
// the next round to be simulated. Tune this to your desired round cadence.
const COOLDOWN_MINUTES = 50;

async function sendTelegramMessage(telegramId: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !telegramId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('[process-matches] Telegram send error:', err);
  }
}

function buildMessage(myTeamName: string, oppName: string, myScore: number, oppScore: number): string {
  const icon =
    myScore > oppScore ? '🏆 *Победа!*' :
    myScore < oppScore ? '❌ *Поражение*' :
                         '🤝 *Ничья*';
  return (
    `${icon}\n\n` +
    `Твоя команда *${myTeamName}* сыграла против *${oppName}*.\n\n` +
    `Счет: *${myScore} – ${oppScore}*\n\n` +
    `Зайдите в игру, чтобы посмотреть журнал событий и получить награды!`
  );
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader  = req.headers.get('authorization');
    const manualSecret = req.nextUrl?.searchParams?.get('secret');
    const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const validSecret = manualSecret === process.env.CRON_SECRET_MANUAL;

    if (!validBearer && !validSecret) {
      console.warn('[process-matches] Unauthorized request blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Idempotency Gate: Cooldown Check ─────────────────────────────────────
    // Find the most recently completed match across the entire system.
    const { data: lastCompleted } = await supabaseAdmin
      .from('league_matches')
      .select('updated_at, round_number')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCompleted?.updated_at) {
      const lastTime    = new Date(lastCompleted.updated_at).getTime();
      const now         = Date.now();
      const elapsedMin  = (now - lastTime) / 1000 / 60;

      if (elapsedMin < COOLDOWN_MINUTES) {
        const remainingMin = Math.ceil(COOLDOWN_MINUTES - elapsedMin);
        console.log(
          `[process-matches] Cooldown active. Last round=${lastCompleted.round_number}, ` +
          `elapsed=${elapsedMin.toFixed(1)}min, next allowed in ${remainingMin}min.`
        );
        return NextResponse.json({
          success: true,
          cooldown: true,
          message: `Cooldown active. Next round in ~${remainingMin} min.`,
          elapsed_minutes: Math.floor(elapsedMin),
          cooldown_minutes: COOLDOWN_MINUTES,
        });
      }
    }

    // ── Find next pending round ───────────────────────────────────────────────
    const { data: unplayedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('status', 'pending')
      .order('round_number', { ascending: true })
      .limit(1);

    if (!unplayedMatches || unplayedMatches.length === 0) {
      return NextResponse.json({ success: true, message: 'No unplayed rounds left.' });
    }

    const targetRound = unplayedMatches[0].round_number;

    const { data: matches } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('round_number', targetRound)
      .eq('status', 'pending');

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches found for round.' });
    }

    console.log(`[process-matches] Processing round ${targetRound} — ${matches.length} matches.`);

    // ── Simulate all matches in the round ────────────────────────────────────
    for (const match of matches) {
      await resolveMatch(match.id);
    }

    // ── Notify players via Telegram ───────────────────────────────────────────
    const { data: resolvedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('round_number', targetRound);

    if (resolvedMatches) {
      const teamIds = new Set<string>();
      resolvedMatches.forEach(r => { teamIds.add(r.home_team_id); teamIds.add(r.away_team_id); });

      const { data: teamsData } = await supabaseAdmin
        .from('teams').select('id, user_id').in('id', Array.from(teamIds));

      const userIds = teamsData?.map(t => t.user_id).filter(Boolean) || [];

      const { data: usersData } = await supabaseAdmin
        .from('users').select('id, telegram_id').in('id', userIds).not('telegram_id', 'is', null);

      const userTgMap: Record<string, string> = {};
      if (usersData && teamsData) {
        teamsData.forEach(t => {
          const user = usersData.find(u => u.id === t.user_id);
          if (user?.telegram_id && !user.telegram_id.startsWith('bot_')) {
            userTgMap[t.id] = user.telegram_id;
          }
        });
      }

      const sendPromises: Promise<void>[] = [];
      for (const report of resolvedMatches) {
        const hTgId = userTgMap[report.home_team_id];
        const aTgId = userTgMap[report.away_team_id];
        const homeName  = (report.home_team as any)?.name || 'Home';
        const awayName  = (report.away_team as any)?.name || 'Away';
        const homeScore = report.home_score || 0;
        const awayScore = report.away_score || 0;

        if (hTgId) sendPromises.push(sendTelegramMessage(hTgId, buildMessage(homeName, awayName, homeScore, awayScore)));
        if (aTgId) sendPromises.push(sendTelegramMessage(aTgId, buildMessage(awayName, homeName, awayScore, homeScore)));
      }
      await Promise.all(sendPromises);
    }

    console.log(`[process-matches] Round ${targetRound} completed successfully.`);
    return NextResponse.json({
      success: true,
      processed: matches.length,
      message: `Round ${targetRound} processed.`,
    });

  } catch (error: any) {
    console.error('[process-matches] Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
