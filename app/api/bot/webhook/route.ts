import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

const getToken = () => process.env.TELEGRAM_BOT_TOKEN;
const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL;

// Initialize bot lazily to handle missing env vars gracefully on import
let bot: Telegraf | null = null;
try {
  const token = getToken();
  if (token) {
    bot = new Telegraf(token);

    bot.start((ctx) => {
      const appUrl = getAppUrl();
      if (!appUrl) {
        ctx.reply('⚠️ Configuration error: NEXT_PUBLIC_APP_URL is not set.');
        return;
      }

      const message = `
🌟 **Welcome to FitManager! / Добро пожаловать в FitManager!** 🌟

Enter the cyberpunk world of football management. Connect your team and dominate the league.
Погрузитесь в киберпанк-мир футбольного менеджмента. Создайте свою команду и доминируйте в лиге.
      `;

      ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Play / Играть 🚀',
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      });
    });
  }
} catch (error) {
  console.error('Failed to initialize Telegraf bot:', error);
}

export async function POST(req: NextRequest) {
  try {
    if (!bot) {
      return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 });
    }

    const body = await req.json();
    
    // Process the update with Telegraf
    await bot.handleUpdate(body);

    // Return 200 OK so Telegram knows the update was received successfully
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
