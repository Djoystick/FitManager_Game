export interface PersonalNotification {
  id: string;
  user_id: string;
  type: 'transfer' | 'injury' | 'challenge' | 'system' | 'friend_request' | 'pvp_challenge';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface BilingualText {
  en: string;
  ru: string;
}

export function resolveBilingual(raw: string, lang: string): string {
  try {
    const parsed = JSON.parse(raw) as BilingualText;
    if (parsed && typeof parsed.en === 'string') {
      return lang === 'ru' ? (parsed.ru ?? parsed.en) : parsed.en;
    }
  } catch {
    // not JSON — plain string fallback
  }
  return raw;
}
