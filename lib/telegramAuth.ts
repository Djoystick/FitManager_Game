import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  user?: TelegramUser;
  error?: string;
}

export function validateTelegramWebAppData(initData: string, botToken: string): ValidationResult {
  if (!initData) {
    return { isValid: false, error: 'Missing initData parameter' };
  }
  if (!botToken) {
    return { isValid: false, error: 'Missing bot token' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return { isValid: false, error: 'Invalid initData payload: missing hash' };
    }

    urlParams.delete('hash');
    
    const paramsArray: string[] = [];
    urlParams.forEach((value, key) => {
      paramsArray.push(`${key}=${value}`);
    });
    paramsArray.sort();
    
    const dataCheckString = paramsArray.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { isValid: false, error: 'Invalid cryptographic signature' };
    }

    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { isValid: false, error: 'Missing auth_date' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    
    // Disallow initData older than 24 hours
    if (now - authDate > 86400) {
      return { isValid: false, error: 'Session expired' };
    }

    const userStr = urlParams.get('user');
    if (!userStr) {
      return { isValid: false, error: 'Missing user data payload' };
    }

    const user: TelegramUser = JSON.parse(userStr);
    
    return { isValid: true, user };

  } catch (error: any) {
    return { isValid: false, error: error.message };
  }
}
