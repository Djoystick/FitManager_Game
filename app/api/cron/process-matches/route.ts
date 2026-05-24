import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { matchService, MatchResult } from '@/services/matchService';

// ─── Helper ───────────────────────────────────────────────────────────────────

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(telegramId: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !telegramId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    telegramId,
        text:       message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[process-matches] Telegram send error:', err);
  }
}

function buildMessage(
  result:     MatchResult,
  myTeamName: string,
  oppName:    string,
  myScore:    number,
  oppScore:   number
): string {
  const icon =
    myScore > oppScore ? '🏆 *Victory!*' :
    myScore < oppScore ? '❌ *Defeat*'  :
                         '🤝 *Draw*';

  return (
    `${icon}\n` +
    `Your team *${myTeamName}* vs *${oppName}*.\n\n` +
    `Final Score: *${myScore} – ${oppScore}*\n\n` +
    `⚠️ Starting 11 lost *${result.stamina_drained}* Stamina.\n` +
    `📊 Power: \`${result.h_final_power ?? '?'}\` vs \`${result.a_final_power ?? '?'}\``
  );
}

async function getTelegramId(teamId: string): Promise<string | null> {
  const { data } = await supabase
    .from('teams')
    .select('users!inner(telegram_id)')
    .eq('id', teamId)
    .single();

  const raw: any = data;
  if (!raw) return null;

  // Supabase may return the join as an object or array depending on the client version
  const usersNode = Array.isArray(raw.users) ? raw.users[0] : raw.users;
  return usersNode?.telegram_id ?? null;
}

// ─── Cron Handler ─────────────────────────────────────────────────────────────

export async function GET(_req: Request) {
  try {
    // 1. Fetch the processing queue via matchService (cached, type-safe)
    const matches = await matchService.fetchPendingMatches();

    if (matches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches to process' });
    }

    let processedCount = 0;
    const errors: string[] = [];

    // 2. Sequentially simulate each match
    for (const match of matches) {
      const result = await matchService.conductMatch(match.id);

      if (!result) {
        errors.push(match.id);
        continue;
      }

      processedCount++;

      // 3. Resolve Telegram IDs for both managers in parallel
      const [homeTgId, awayTgId] = await Promise.all([
        getTelegramId(match.home_team_id),
        getTelegramId(match.away_team_id),
      ]);

      const h_name = (match as any).home_team?.name ?? 'Home';
      const a_name = (match as any).away_team?.name ?? 'Away';

      // 4. Dispatch notifications
      if (homeTgId) {
        await sendTelegramMessage(
          homeTgId,
          buildMessage(result, h_name, a_name, result.home_score, result.away_score)
        );
      }

      if (awayTgId) {
        await sendTelegramMessage(
          awayTgId,
          buildMessage(result, a_name, h_name, result.away_score, result.home_score)
        );
      }
    }

    return NextResponse.json({
      success:   true,
      processed: processedCount,
      failed:    errors.length,
      failedIds: errors,
    });

  } catch (error: any) {
    console.error('[process-matches] Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
