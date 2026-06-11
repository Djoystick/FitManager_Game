import fs from 'fs';
import https from 'https';

const envFile = '.env.local';
let token = '';
const channelId = '@FitManagerWeb3';
const messageId = 15;

if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('TELEGRAM_BOT_TOKEN=')) {
      token = line.split('=')[1].trim();
    }
  }
}

if (!token) {
  console.error('Token not found');
  process.exit(1);
}

const text = `🚀 **DEV-BLOG: Движок Match Engine V4.0 готов!** 🚀

Всем привет, Менеджеры! ⚽️ Мы завершили масштабное обновление подкапотной математики и логики симуляции нашей игры. Match Engine V4 — это настоящий прорыв!

Что нового:
🧠 **Умная Тактика:** 6 тактических стилей (от Tiki-Taka до Park the Bus), которые радикально меняют ход игры.
🔥 **Драматургия и Моментум:** Эффект домашних трибун, камбэки на 90-й минуте и "режим отчаяния", если команда проигрывает 0:2.
⚽ **Новые События:** Офсайды, удары в штангу, автоголы и сейвы пенальти — теперь читать журнал матчей стало по-настоящему захватывающе!
🟥 **Карточки и Стамина:** Удаления за две желтые (с жестким дебаффом для всей команды) и динамическая усталость в зависимости от фазы матча.

Прямо сейчас мы также ведем масштабную зачистку интерфейса (строгое разделение Русского и Английского языков во всем приложении).

Спасибо, что вы с нами! Готовьте ваши команды к новым тактическим баталиям! 🏆`;

const payload = JSON.stringify({
  chat_id: channelId,
  message_id: messageId,
  text: text,
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🎮 Запустить игру',
          url: 'https://t.me/FitManagerWeb3_bot/app'
        }
      ]
    ]
  }
});

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${token}/editMessageText`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (e) => console.error(e));
req.write(payload);
req.end();
