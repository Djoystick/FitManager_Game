import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    console.error('[match-warning] Telegram send error:', err);
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find lowest round_number where is_played == false
    const { data: unplayedMatches } = await supabaseAdmin
      .from('league_matches')
      .select('round_number')
      .eq('is_played', false)
      .order('round_number', { ascending: true })
      .limit(1);

    if (!unplayedMatches || unplayedMatches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches scheduled' });
    }

    const targetRound = unplayedMatches[0].round_number;

    // Get all matches for this round
    const { data: matches } = await supabaseAdmin
      .from('league_matches')
      .select('home_team_id, away_team_id')
      .eq('round_number', targetRound)
      .eq('is_played', false);

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches found' });
    }

    const teamIds = new Set<string>();
    matches.forEach(m => {
      if (m.home_team_id) teamIds.add(m.home_team_id);
      if (m.away_team_id) teamIds.add(m.away_team_id);
    });

    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, user_id')
      .in('id', Array.from(teamIds));

    if (!teamsData || teamsData.length === 0) {
      return NextResponse.json({ success: true, message: 'No teams found' });
    }

    const userIds = teamsData.map(t => t.user_id).filter(id => id);

    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, telegram_id')
      .in('id', userIds)
      .not('telegram_id', 'is', null);

    if (!usersData || usersData.length === 0) {
      return NextResponse.json({ success: true, message: 'No telegram IDs found' });
    }

    const warningMessage = `⚠️ Внимание!\n\nЗайдите в игру и настройте свой состав, через 15 минут он будет зафиксирован и отправится играть матч (Раунд ${targetRound})!`;

    const sendPromises = usersData.map(user => {
      // Exclude bots
      if (user.telegram_id.startsWith('bot_')) return Promise.resolve();
      return sendTelegramMessage(user.telegram_id, warningMessage);
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, message: `Sent warnings for Round ${targetRound}` });
  } catch (err: any) {
    console.error('[match-warning] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
