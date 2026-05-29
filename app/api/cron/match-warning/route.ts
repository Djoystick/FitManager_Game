import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ─── Idempotency gate ────────────────────────────────────────────────────────
// The warning fires at HH:45. The last match completed at HH:00.
// So elapsed since last completed should be ~45min when this fires.
// We allow the warning ONLY if:
//   a) there IS a pending round, AND
//   b) the last completed match was 35–65 min ago (window = safe warning zone)
//      OR there have been no completed matches yet (first round ever).
// This prevents duplicate spamming if GitHub Actions or another cron calls us twice.
const WARN_WINDOW_MIN  = 35; // don't warn earlier than this after last match
const WARN_WINDOW_MAX  = 65; // don't warn later than this (next match would have already played)

async function sendTelegramMessage(telegramId: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !telegramId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('[match-warning] Telegram send error:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader   = req.headers.get('authorization');
    const manualSecret = req.nextUrl?.searchParams?.get('secret');
    const validBearer  = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const validSecret  = manualSecret === process.env.CRON_SECRET_MANUAL;

    if (!validBearer && !validSecret) {
      console.warn('[match-warning] Unauthorized request blocked.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Idempotency Gate: Time-window check ───────────────────────────────────
    const { data: lastCompleted } = await supabaseAdmin
      .from('league_matches')
      .select('updated_at, round_number')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCompleted?.updated_at) {
      const lastTime   = new Date(lastCompleted.updated_at).getTime();
      const elapsedMin = (Date.now() - lastTime) / 1000 / 60;

      if (elapsedMin < WARN_WINDOW_MIN) {
        console.log(`[match-warning] Too early to warn (${elapsedMin.toFixed(1)}min elapsed, need >${WARN_WINDOW_MIN}min).`);
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `Warning window not reached yet. Elapsed: ${Math.floor(elapsedMin)}min.`,
        });
      }

      if (elapsedMin > WARN_WINDOW_MAX) {
        console.log(`[match-warning] Warning window passed (${elapsedMin.toFixed(1)}min elapsed, max=${WARN_WINDOW_MAX}min).`);
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `Warning window expired. Next match likely already playing.`,
        });
      }
    }
    // If no completed match exists at all, we're in the very first round — allow the warning.

    // ── Find next pending round ───────────────────────────────────────────────
    const { data: unplayedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('is_played', false)
      .order('round_number', { ascending: true })
      .limit(1);

    if (!unplayedMatches || unplayedMatches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches scheduled.' });
    }

    const targetRound = unplayedMatches[0].round_number;

    // ── Get all teams playing in this round ───────────────────────────────────
    const { data: matches } = await supabaseAdmin
      .from('league_matches')
      .select('home_team_id, away_team_id')
      .eq('round_number', targetRound)
      .eq('is_played', false);

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches found.' });
    }

    const teamIds = new Set<string>();
    matches.forEach(m => {
      if (m.home_team_id) teamIds.add(m.home_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    });

    const { data: teamsData } = await supabaseAdmin
      .from('teams').select('id, user_id').in('id', Array.from(teamIds));

    if (!teamsData || teamsData.length === 0) {
      return NextResponse.json({ success: true, message: 'No teams found.' });
    }

    const userIds = teamsData.map(t => t.user_id).filter(Boolean);

    const { data: usersData } = await supabaseAdmin
      .from('users').select('id, telegram_id').in('id', userIds).not('telegram_id', 'is', null);

    if (!usersData || usersData.length === 0) {
      return NextResponse.json({ success: true, message: 'No telegram IDs found.' });
    }

    const warningMessage =
      `⚠️ *Внимание, тренер!*\n\n` +
      `Через ~15 минут начнётся *Раунд ${targetRound}*!\n\n` +
      `Зайдите в игру и настройте состав — он будет зафиксирован и отправлен на матч.\n\n` +
      `FitManager 🏟️`;

    const sendPromises = usersData
      .filter(u => u.telegram_id && !u.telegram_id.startsWith('bot_'))
      .map(u => sendTelegramMessage(u.telegram_id, warningMessage));

    await Promise.all(sendPromises);

    console.log(`[match-warning] Sent ${sendPromises.length} warnings for Round ${targetRound}.`);
    return NextResponse.json({
      success: true,
      sent: sendPromises.length,
      message: `Warnings sent for Round ${targetRound}.`,
    });

  } catch (err: any) {
    console.error('[match-warning] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
