import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function GET(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!token || !appUrl) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL not configured in environment' },
        { status: 500 }
      );
    }

    const bot = new Telegraf(token);
    // Ensure appUrl doesn't have a trailing slash to avoid double slashes
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    const webhookUrl = `${baseUrl}/api/bot/webhook`;

    const result = await bot.telegram.setWebhook(webhookUrl);

    if (result) {
      return NextResponse.json(
        { success: true, message: `Webhook successfully registered at ${webhookUrl}` },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to register webhook' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error registering webhook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
