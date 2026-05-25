'use client';

import { createContext, useEffect, useState, ReactNode, useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';

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
  const { setLanguage } = useContext(LanguageContext);

  useEffect(() => {
    setIsMounted(true);

    const authenticate = async () => {
      try {
        if (typeof window !== 'undefined') {
          const twaModule = await import('@twa-dev/sdk');
          const WebApp = twaModule.default;

          WebApp.ready();
          const initData = WebApp.initData;

          const lang = WebApp.initDataUnsafe?.user?.language_code;
          if (lang && lang.startsWith('ru')) {
            setLanguage('ru');
          }

          if (!initData) {
            console.warn("No Telegram initData found. Running outside of Telegram environment.");
            setIsLoading(false);
            return;
          }

          // Send initData to our secure API route to validate signature and set HttpOnly cookie
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
  }, [setLanguage]);

  if (!isMounted || isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-space-dark relative overflow-hidden">
        <style>{`
          @keyframes dash-pulse {
            0% { stroke-dashoffset: 280; }
            100% { stroke-dashoffset: 0; }
          }
          .ekg-line {
            stroke-dasharray: 40 280;
            animation: dash-pulse 1.8s linear infinite;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
        `}</style>
        
        {/* SVG Container */}
        <div className="w-64 h-24 relative flex justify-center items-center">
          <svg viewBox="0 0 200 50" className="w-full h-full overflow-visible">
             {/* Faded Background Line */}
             <path d="M 0 25 L 80 25 L 90 5 L 100 45 L 110 25 L 200 25" fill="none" stroke="#00f3ff" strokeWidth="2" className="opacity-10" />
             {/* Glowing Animated Pulse */}
             <path d="M 0 25 L 80 25 L 90 5 L 100 45 L 110 25 L 200 25" fill="none" stroke="#00f3ff" strokeWidth="3" className="ekg-line drop-shadow-[0_0_8px_rgba(0,240,255,1)]" />
          </svg>
        </div>

        <h2 className="mt-8 text-sm font-bold tracking-[0.3em] font-orbitron uppercase text-neon-cyan animate-pulse drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
          Authenticating
        </h2>
        <p className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mt-3 opacity-60">
          Connecting to Telegram Secure Gateway...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-space-dark p-6 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <span className="text-red-500 text-2xl font-black">!</span>
        </div>
        <h2 className="text-lg font-bold text-red-500 mb-2">Access Denied</h2>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <TelegramAuthContext.Provider value={{ isAuthenticated, userId, isLoading: false, error: null }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
