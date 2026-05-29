import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { simulateNextRound } from '@/app/actions/calendarActions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(telegramId: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !telegramId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[process-matches] Telegram send error:', err);
  }
}

function buildMessage(
  myTeamName: string,
  oppName: string,
  myScore: number,
  oppScore: number
): string {
  const icon =
    myScore > oppScore ? '🏆 *Победа!*' :
    myScore < oppScore ? '❌ *Поражение*'  :
                         '🤝 *Ничья*';

  return (
    `${icon}\n\n` +
    `Твоя команда *${myTeamName}* сыграла против *${oppName}*.\n\n` +
    `Счет: *${myScore} – ${oppScore}*\n\n` +
    `Зайдите в игру, чтобы посмотреть журнал событий и получить награды!`
  );
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Simulate the next unplayed round
    const simResult = await simulateNextRound();

    if (!simResult.success) {
      return NextResponse.json({ success: true, message: simResult.error || 'No matches to process' });
    }

    const matchReports = simResult.matchReports || [];

    // 2. Fetch telegram IDs for all involved teams
    const teamIds = new Set<string>();
    matchReports.forEach((r: any) => {
      teamIds.add(r.home_team_id);
      teamIds.add(r.away_team_id);
    });

    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, user_id')
      .in('id', Array.from(teamIds));

    const userIds = teamsData?.map(t => t.user_id).filter(id => id) || [];

    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, telegram_id')
      .in('id', userIds)
      .not('telegram_id', 'is', null);

    const userTgMap: Record<string, string> = {};
    if (usersData && teamsData) {
      teamsData.forEach(t => {
        const user = usersData.find(u => u.id === t.user_id);
        if (user && user.telegram_id && !user.telegram_id.startsWith('bot_')) {
          userTgMap[t.id] = user.telegram_id;
        }
      });
    }

    // 3. Dispatch notifications
    const sendPromises: Promise<void>[] = [];

    for (const report of matchReports) {
      const hTgId = userTgMap[report.home_team_id];
      const aTgId = userTgMap[report.away_team_id];

      if (hTgId) {
        sendPromises.push(sendTelegramMessage(
          hTgId,
          buildMessage(report.home_team_name, report.away_team_name, report.home_score, report.away_score)
        ));
      }

      if (aTgId) {
        sendPromises.push(sendTelegramMessage(
          aTgId,
          buildMessage(report.away_team_name, report.home_team_name, report.away_score, report.home_score)
        ));
      }
    }

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      processed: matchReports.length,
      message: simResult.message
    });

  } catch (error: any) {
    console.error('[process-matches] Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
