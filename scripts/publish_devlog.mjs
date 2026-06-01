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
  let imagePath = null;
  let textArgs = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--image' && i + 1 < args.length) {
      imagePath = args[i + 1];
      i++; // skip next arg
    } else {
      textArgs.push(args[i]);
    }
  }

  const rawMessage = textArgs.join(' ');

  if (!rawMessage && !imagePath) {
    console.error("❌ Error: No message provided. Usage: node publish_devlog.mjs [--image path/to/image.png] 'Your message here'");
    process.exit(1);
  }

  // Parse markdown-like content into Telegram HTML if necessary, or just send as MarkdownV2/HTML
  const htmlMessage = rawMessage
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // bold
    .replace(/\*(.*?)\*/g, '<i>$1</i>')     // italic
    .replace(/__(.*?)__/g, '<u>$1</u>')     // underline
    .replace(/`(.*?)`/g, '<code>$1</code>') // code
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>') // links
    .replace(/\\n/g, '\n'); // parse literal \n passed from command line into actual newlines

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "🕹 Запустить Игру",
          url: "https://t.me/fitmanager_game_bot/FitManager"
        }
      ]
    ]
  };

  try {
    let url = `https://api.telegram.org/bot${token}/sendMessage`;
    let options = {};

    if (imagePath && fs.existsSync(imagePath)) {
      console.log(`Uploading image ${imagePath}...`);
      url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const formData = new FormData();
      
      const fileBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.gif') mimeType = 'image/gif';
      
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('photo', blob, path.basename(imagePath));
      formData.append('chat_id', channelId);
      if (htmlMessage) formData.append('caption', htmlMessage);
      formData.append('parse_mode', 'HTML');
      formData.append('reply_markup', JSON.stringify(replyMarkup));

      options = {
        method: 'POST',
        body: formData
      };
    } else {
      const payload = {
        chat_id: channelId,
        text: htmlMessage,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      };

      options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };
    }

    console.log(`Sending message to ${channelId}...`);
    const response = await fetch(url, options);
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
