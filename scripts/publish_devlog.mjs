import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually since this is a simple script
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  } catch (err) {
    console.warn("Could not read .env.local, relying on process.env");
  }
}

async function publishDevlog() {
  loadEnv();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token || !channelId) {
    console.error("❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID is missing in .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const rawMessage = args.join(' ');

  if (!rawMessage) {
    console.error("❌ Error: No message provided. Usage: node publish_devlog.mjs 'Your message here'");
    process.exit(1);
  }

  // Parse markdown-like content into Telegram HTML if necessary, or just send as MarkdownV2/HTML
  // Telegram requires specific formatting. We'll send it as HTML to avoid escaping hell of MarkdownV2.
  
  // Basic markdown to HTML conversion for Telegram
  const htmlMessage = rawMessage
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // bold
    .replace(/\*(.*?)\*/g, '<i>$1</i>')     // italic
    .replace(/__(.*?)__/g, '<u>$1</u>')     // underline
    .replace(/`(.*?)`/g, '<code>$1</code>') // code
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>') // links
    .replace(/\\n/g, '\n'); // parse literal \n passed from command line into actual newlines

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: channelId,
    text: htmlMessage,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🕹 Запустить Игру",
            url: "https://t.me/fitmanager_game_bot/FitManager"
          }
        ]
      ]
    }
  };

  try {
    console.log(`Sending message to ${channelId}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ok) {
      console.log("✅ DevLog successfully published to Telegram!");
      console.log(`Message ID: ${data.result.message_id}`);
    } else {
      console.error("❌ Telegram API Error:", data.description);
    }
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}

publishDevlog();
