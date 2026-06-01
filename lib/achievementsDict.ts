export type AchievementCode = 'WELCOME';

export interface AchievementDef {
  code: AchievementCode;
  icon: string;
  title: { en: string; ru: string };
  description: { en: string; ru: string };
  reward: {
    fc?: number;
    ton?: number;
    sp?: number;
  };
}

export const ACHIEVEMENTS: Record<AchievementCode, AchievementDef> = {
  'WELCOME': {
    code: 'WELCOME',
    icon: '🎉',
    title: { 
      en: 'Welcome to FitManager!', 
      ru: 'Добро пожаловать!' 
    },
    description: { 
      en: 'You created your first club. Here is your starting budget!', 
      ru: 'Вы создали свой первый клуб. Вот ваш стартовый бюджет!' 
    },
    reward: {
      fc: 5000,
      ton: 0.1
    }
  }
};
