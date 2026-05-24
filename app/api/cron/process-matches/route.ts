import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // 1. Fetch matches scheduled for today or earlier that are not simulated
    const { data: matches, error: fetchError } = await supabase
      .from('matches')
      .select(`
        id, 
        home_team_id, 
        away_team_id, 
        home_team:teams!home_team_id(name), 
        away_team:teams!away_team_id(name)
      `)
      .eq('is_simulated', false)
      .lte('match_date', new Date().toISOString());

    if (fetchError) {
      console.error("Fetch scheduled matches error:", fetchError);
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, message: 'No matches to process' });
    }

    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    const sendTelegramMessage = async (telegramId: string, message: string) => {
      if (!TELEGRAM_TOKEN || !telegramId) return;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'Markdown' })
        });
      } catch (err) {
        console.error("Failed to send telegram message", err);
      }
    };

    let processedCount = 0;

    // 2. Loop through matches and call conduct_match
    for (const match of matches) {
      const { data: result, error: rpcError } = await supabase.rpc('conduct_match', { m_id: match.id });

      if (rpcError) {
        console.error(`Error simulating match ${match.id}:`, rpcError);
        continue;
      }

      processedCount++;

      // 3. Extract user_id and telegram_id for both teams
      const { data: homeUserData } = await supabase
        .from('teams')
        .select('users!inner(telegram_id)')
        .eq('id', match.home_team_id)
        .single();
        
      const { data: awayUserData } = await supabase
        .from('teams')
        .select('users!inner(telegram_id)')
        .eq('id', match.away_team_id)
        .single();

      const h_score = result.home_score;
      const a_score = result.away_score;
      // @ts-ignore
      const h_name = match.home_team?.name || 'Home';
      // @ts-ignore
      const a_name = match.away_team?.name || 'Away';

      // 4. Send messages
      const homeUser: any = Array.isArray(homeUserData) ? homeUserData[0] : homeUserData;
      const homeTelegramId = homeUser?.users?.telegram_id || (Array.isArray(homeUser?.users) ? homeUser?.users[0]?.telegram_id : null);
      
      if (homeTelegramId) {
        const resultText = h_score > a_score ? '🏆 *Victory!*' : h_score < a_score ? '❌ *Defeat*' : '🤝 *Draw*';
        const msg = `${resultText}\nYour team *${h_name}* played against *${a_name}*.\n\nFinal Score: *${h_score} - ${a_score}*.\n\n⚠️ Your starting 11 lost ${result.stamina_drained} Stamina.`;
        await sendTelegramMessage(homeTelegramId, msg);
      }

      const awayUser: any = Array.isArray(awayUserData) ? awayUserData[0] : awayUserData;
      const awayTelegramId = awayUser?.users?.telegram_id || (Array.isArray(awayUser?.users) ? awayUser?.users[0]?.telegram_id : null);

      if (awayTelegramId) {
        const resultText = a_score > h_score ? '🏆 *Victory!*' : a_score < h_score ? '❌ *Defeat*' : '🤝 *Draw*';
        const msg = `${resultText}\nYour team *${a_name}* played against *${h_name}*.\n\nFinal Score: *${a_score} - ${h_score}*.\n\n⚠️ Your starting 11 lost ${result.stamina_drained} Stamina.`;
        await sendTelegramMessage(awayTelegramId, msg);
      }
    }

    return NextResponse.json({ success: true, processed: processedCount });

  } catch (error: any) {
    console.error("Process Matches Cron Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
