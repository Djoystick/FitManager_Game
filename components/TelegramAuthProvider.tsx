'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import WebApp from '@twa-dev/sdk';

interface TelegramAuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const TelegramAuthContext = createContext<TelegramAuthContextType>({
  isAuthenticated: false,
  userId: null,
  isLoading: true,
  error: null,
});

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authenticate = async () => {
      try {
        // Ensure we are in a browser environment
        if (typeof window !== 'undefined') {
          WebApp.ready();
          const initData = WebApp.initData;

          // Fallback for local browser testing outside of Telegram Web App
          if (!initData) {
            console.warn("No Telegram initData found. Running outside of Telegram environment.");
            setIsLoading(false);
            return;
          }

          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ initData }),
          });

          if (!response.ok) {
            throw new Error('Failed to authenticate with backend');
          }

          const data = await response.json();
          setIsAuthenticated(true);
          setUserId(data.user_id);
        }
      } catch (err: any) {
        console.error("Telegram Auth Error:", err);
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    authenticate();
  }, []);

  return (
    <TelegramAuthContext.Provider value={{ isAuthenticated, userId, isLoading, error }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
