import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export type AchievementConfig = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardFC: number;
  rewardTON: number;
};

// Hardcoded achievements config based on the list
export const ACHIEVEMENTS: Record<string, AchievementConfig> = {
  // GENERAL
  'WELCOME': { id: 'WELCOME', name: 'Добро пожаловать!', description: 'Создать свой первый клуб', icon: '🎉', rewardFC: 500, rewardTON: 0 },
  'WALLET_LINK': { id: 'WALLET_LINK', name: 'В крипте!', description: 'Подключить TON кошелек', icon: '💎', rewardFC: 250, rewardTON: 0 },
  'FACE_REVEAL': { id: 'FACE_REVEAL', name: 'Смена имиджа', description: 'Изменить логотип/аватар команды', icon: '🎨', rewardFC: 100, rewardTON: 0 },
  
  // MATCHES
  'FIRST_MATCH': { id: 'FIRST_MATCH', name: 'Боевое крещение', description: 'Сыграть свой первый матч', icon: '⚔️', rewardFC: 100, rewardTON: 0 },
  'FIRST_WIN': { id: 'FIRST_WIN', name: 'Вкус победы', description: 'Выиграть первый матч', icon: '🥇', rewardFC: 200, rewardTON: 0 },
  'TEN_WINS': { id: 'TEN_WINS', name: 'Набирая обороты', description: 'Выиграть 10 матчей за все время', icon: '🚀', rewardFC: 500, rewardTON: 0 },
  'CENTURY_WINS': { id: 'CENTURY_WINS', name: 'Легенда стадиона', description: 'Выиграть 100 матчей за все время', icon: '👑', rewardFC: 2500, rewardTON: 0.1 },
  'STREAK_3': { id: 'STREAK_3', name: 'На кураже', description: 'Выиграть 3 матча подряд', icon: '🔥', rewardFC: 300, rewardTON: 0 },
  'CLEAN_SHEET': { id: 'CLEAN_SHEET', name: 'Автобус', description: 'Отыграть матч "на ноль"', icon: '🚌', rewardFC: 150, rewardTON: 0 },
  'GOAL_FEST': { id: 'GOAL_FEST', name: 'Разгром', description: 'Забить 5 и более мячей в одном матче', icon: '⚽', rewardFC: 200, rewardTON: 0 },

  // INFRASTRUCTURE
  'STADIUM_LVL_2': { id: 'STADIUM_LVL_2', name: 'Растем', description: 'Прокачать Стадион до 2 уровня', icon: '🏗️', rewardFC: 300, rewardTON: 0 },
  'STADIUM_LVL_5': { id: 'STADIUM_LVL_5', name: 'Колизей', description: 'Прокачать Стадион до 5 уровня', icon: '🏟️', rewardFC: 1500, rewardTON: 0.05 },
  'ACADEMY_LVL_5': { id: 'ACADEMY_LVL_5', name: 'Кузница талантов', description: 'Прокачать Академию до 5 уровня', icon: '🎓', rewardFC: 1500, rewardTON: 0.05 },
  'TRAINING_LVL_5': { id: 'TRAINING_LVL_5', name: 'Идеальный газон', description: 'Прокачать Базу до 5 ур.', icon: '🏋️', rewardFC: 1500, rewardTON: 0.05 },
  'FULL_HOUSE': { id: 'FULL_HOUSE', name: 'Мега-Босс', description: 'Все 3 здания минимум 5 уровня', icon: '🏙️', rewardFC: 5000, rewardTON: 0.2 },

  // TRANSFERS & TEAM
  'FIRST_BUY': { id: 'FIRST_BUY', name: 'Скаут', description: 'Купить первого игрока на Рынке', icon: '🛒', rewardFC: 100, rewardTON: 0 },
  'FIRST_SELL': { id: 'FIRST_SELL', name: 'Бизнесмен', description: 'Продать игрока', icon: '💰', rewardFC: 100, rewardTON: 0 },
  'MARKET_GURU': { id: 'MARKET_GURU', name: 'Акула рынка', description: 'Купить 10 игроков', icon: '🦈', rewardFC: 500, rewardTON: 0 },
  'TRAINING_DAY': { id: 'TRAINING_DAY', name: 'Тяжело в учении', description: 'Провести 10 тренировок', icon: '🏃', rewardFC: 250, rewardTON: 0 },
  'OVR_75': { id: 'OVR_75', name: 'Неплохой старт', description: 'Средний рейтинг команды 75', icon: '⭐', rewardFC: 500, rewardTON: 0 },
  'OVR_85': { id: 'OVR_85', name: 'Галактикос', description: 'Средний рейтинг команды 85', icon: '🌟', rewardFC: 2500, rewardTON: 0.1 },

  // LEAGUE
  'PROMOTION': { id: 'PROMOTION', name: 'На повышение!', description: 'Перейти в лигу выше', icon: '📈', rewardFC: 1000, rewardTON: 0 },
  'LEAGUE_CHAMP': { id: 'LEAGUE_CHAMP', name: 'Чемпион!', description: 'Занять 1-е место в лиге', icon: '🏆', rewardFC: 3000, rewardTON: 0.1 },
  'TOP_LEAGUE': { id: 'TOP_LEAGUE', name: 'Элита', description: 'Достичь 1-й Лиги', icon: '👑', rewardFC: 10000, rewardTON: 1.0 },

  // SECRETS
  'LUCKY_NUMBER': { id: 'LUCKY_NUMBER', name: 'Джекпот', description: 'Иметь 77,777 FC на балансе', icon: '🎰', rewardFC: 7777, rewardTON: 0 },
};

/**
 * Checks if a team has already unlocked an achievement.
 * If not, unlocks it, distributes the reward, and sends a notification.
 */
export async function checkAndUnlockAchievement(teamId: string, achievementCode: string) {
  try {
    const config = ACHIEVEMENTS[achievementCode];
    if (!config) return false;

    const { data: existing } = await supabaseAdmin
      .from('team_achievements')
      .select('id')
      .eq('team_id', teamId)
      .eq('achievement_code', achievementCode)
      .single();

    if (existing) return false; // Already unlocked

    const { error: insertError } = await supabaseAdmin
      .from('team_achievements')
      .insert({ team_id: teamId, achievement_code: achievementCode });

    if (insertError) return false;

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (!team) return true;
    const userId = team.user_id;

    if (config.rewardFC > 0 || config.rewardTON > 0) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('balance_fancoins, balance_ton')
        .eq('id', userId)
        .single();

      if (user) {
        const newFC = parseInt(user.balance_fancoins) + config.rewardFC;
        const newTON = parseFloat((user.balance_ton || 0)) + config.rewardTON;

        await supabaseAdmin
          .from('users')
          .update({ balance_fancoins: newFC, balance_ton: newTON })
          .eq('id', userId);
      }
    }

    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'ACHIEVEMENT_UNLOCKED',
        payload: {
          achievementId: config.id,
          name: config.name,
          icon: config.icon,
          rewardFC: config.rewardFC,
          rewardTON: config.rewardTON
        }
      });

    console.log(`[Achievements] 🏆 Unlocked ${achievementCode} for team ${teamId}!`);
    return true;

  } catch (err) {
    console.error(`[Achievements] Error unlocking ${achievementCode}:`, err);
    return false;
  }
}

// ---------------------------------------------------------
// TRIGGERS
// ---------------------------------------------------------

export async function triggerMatchAchievements(teamId: string, isWin: boolean, gf: number, ga: number) {
  await checkAndUnlockAchievement(teamId, 'FIRST_MATCH');
  
  if (isWin) {
    await checkAndUnlockAchievement(teamId, 'FIRST_WIN');
  }
  if (ga === 0) {
    await checkAndUnlockAchievement(teamId, 'CLEAN_SHEET');
  }
  if (gf >= 5) {
    await checkAndUnlockAchievement(teamId, 'GOAL_FEST');
  }

  // Check stats for complex achievements
  const { data: team } = await supabaseAdmin.from('teams').select('stats').eq('id', teamId).single();
  const stats = (team?.stats as any) || {};
  
  // Update stats
  const totalMatches = (stats.total_matches || 0) + 1;
  const wins = (stats.wins || 0) + (isWin ? 1 : 0);
  const streak = isWin ? ((stats.streak || 0) + 1) : 0;
  
  await supabaseAdmin.from('teams').update({
    stats: { ...stats, total_matches: totalMatches, wins, streak }
  }).eq('id', teamId);

  // Check stat thresholds
  if (wins >= 10) await checkAndUnlockAchievement(teamId, 'TEN_WINS');
  if (wins >= 100) await checkAndUnlockAchievement(teamId, 'CENTURY_WINS');
  if (streak >= 3) await checkAndUnlockAchievement(teamId, 'STREAK_3');
}

export async function triggerInfrastructureAchievements(teamId: string) {
  const { data: infra } = await supabaseAdmin.from('infrastructure').select('*').eq('team_id', teamId).single();
  if (!infra) return;

  const sl = infra.stadium_level || 1;
  const al = infra.academy_level || 1;
  const tl = infra.training_level || 1;

  if (sl >= 2) await checkAndUnlockAchievement(teamId, 'STADIUM_LVL_2');
  if (sl >= 5) await checkAndUnlockAchievement(teamId, 'STADIUM_LVL_5');
  if (al >= 5) await checkAndUnlockAchievement(teamId, 'ACADEMY_LVL_5');
  if (tl >= 5) await checkAndUnlockAchievement(teamId, 'TRAINING_LVL_5');
  if (sl >= 5 && al >= 5 && tl >= 5) await checkAndUnlockAchievement(teamId, 'FULL_HOUSE');
}

export async function triggerTransferAchievements(teamId: string, type: 'buy' | 'sell') {
  if (type === 'buy') {
    await checkAndUnlockAchievement(teamId, 'FIRST_BUY');
    
    // Update stats
    const { data: team } = await supabaseAdmin.from('teams').select('stats').eq('id', teamId).single();
    const stats = (team?.stats as any) || {};
    const bought = (stats.players_bought || 0) + 1;
    await supabaseAdmin.from('teams').update({ stats: { ...stats, players_bought: bought } }).eq('id', teamId);

    if (bought >= 10) await checkAndUnlockAchievement(teamId, 'MARKET_GURU');
    await triggerTeamOvrAchievements(teamId);
  } else {
    await checkAndUnlockAchievement(teamId, 'FIRST_SELL');
  }
}

export async function triggerTrainingAchievements(teamId: string) {
  const { data: team } = await supabaseAdmin.from('teams').select('stats').eq('id', teamId).single();
  const stats = (team?.stats as any) || {};
  const trained = (stats.trainings_done || 0) + 1;
  await supabaseAdmin.from('teams').update({ stats: { ...stats, trainings_done: trained } }).eq('id', teamId);

  if (trained >= 10) await checkAndUnlockAchievement(teamId, 'TRAINING_DAY');
  
  await triggerTeamOvrAchievements(teamId);
}

export async function triggerTeamOvrAchievements(teamId: string) {
  const { data: players } = await supabaseAdmin.from('players').select('ovr').eq('team_id', teamId);
  if (players && players.length > 0) {
    const avgOvr = players.reduce((sum, p) => sum + (p.ovr || 0), 0) / players.length;
    if (avgOvr >= 75) await checkAndUnlockAchievement(teamId, 'OVR_75');
    if (avgOvr >= 85) await checkAndUnlockAchievement(teamId, 'OVR_85');
  }
}
