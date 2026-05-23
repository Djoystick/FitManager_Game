'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';

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
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);

    const authenticate = async () => {
      try {
        // Ensure we are strictly executing within a browser environment
        if (typeof window !== 'undefined') {
          // Dynamically import the SDK only on the client to avoid SSR crashes
          const twaModule = await import('@twa-dev/sdk');
          const WebApp = twaModule.default;

          WebApp.ready();
          const initData = WebApp.initData;

          // Fallback for local browser testing outside of the Telegram Web App container
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
            throw new Error('Failed to authenticate with backend servers');
          }

          const data = await response.json();
          setIsAuthenticated(true);
          setUserId(data.user_id);
        }
      } catch (err: any) {
        console.error("Telegram Auth Initialization Error:", err);
        setError(err.message || 'Authentication sequence failed');
      } finally {
        setIsLoading(false);
      }
    };

    authenticate();
  }, []);

  // Prevent server-client hydration mismatches by returning null/loading state until the component safely mounts on the client
  if (!isMounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  return (
    <TelegramAuthContext.Provider value={{ isAuthenticated, userId, isLoading, error }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
