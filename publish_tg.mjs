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

const text = `🔥 **FitManager DevLog: The Armor Update & Social Hub!** 🔥

Менеджеры, мы выкатили массивный апдейт на сервер! 

Что нового:
🛡 **The Armor Update (Безопасность и Экономика)**
Мы полностью переписали ядро транзакций. Теперь вся база данных зашифрована на уровне строк (RLS), а логика матчей и стадионов стала по-настоящему надежной. Ваша экономика и заработанные SweatPoints в полной безопасности!

🤝 **Market Evolution**
Мы продолжаем дорабатывать трансферный рынок, делая его более сбалансированным и честным для всех игроков.

🔔 **Social Hub & Уведомления**
Интерфейс пополнился виджетом уведомлений! Теперь вы не пропустите ничего важного:
• Вам придет пуш, если ваш игрок был продан на рынке.
• Оповещения о травмах в матче.
• Вся система с первого дня поддерживает английский и русский языки.

👀 **Что дальше? (Спойлер)**
Прямо сейчас мы работаем над самым ожидаемым функционалом — **PvP вызовы и Друзья**. Совсем скоро вы сможете найти любой клуб через поиск, добавить менеджера в друзья и бросить ему вызов на PvP-матч с реальными наградами!

Готовьте свои составы, скоро начнется настоящая мясорубка. ⚽️⚡️`;

const payload = JSON.stringify({
  chat_id: channelId,
  text: text,
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🎮 Запустить игру',
          url: 'https://t.me/fitmanager_game_bot/FitManager'
        }
      ]
    ]
  }
});

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${token}/sendMessage`,
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
