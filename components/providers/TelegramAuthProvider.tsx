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

export const useTelegramAuth = () => useContext(TelegramAuthContext);

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLanguage } = useContext(LanguageContext);

  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);
    }, 0);

    const authenticate = async () => {
      try {
        if (typeof window !== 'undefined') {
          const twaModule = await import('@twa-dev/sdk');
          const WebApp = twaModule.default;

          WebApp.ready();
          WebApp.expand();
          try { if (WebApp.requestFullscreen) WebApp.requestFullscreen(); } catch (e) {}
          try { if (WebApp.setHeaderColor) WebApp.setHeaderColor('#060913'); } catch (e) {}
          try { if (WebApp.setBackgroundColor) WebApp.setBackgroundColor('#060913'); } catch (e) {}

          const initData = WebApp.initData;
          const lang = WebApp.initDataUnsafe?.user?.language_code;
          const photoUrl = WebApp.initDataUnsafe?.user?.photo_url;

          if (lang && lang.startsWith('ru')) setLanguage('ru');

          if (!initData) {
            // Running outside Telegram (dev/browser). No error — let app handle routing normally.
            console.warn("No Telegram initData. Running outside Telegram.");
            setIsLoading(false);
            return;
          }

          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, photoUrl }),
          });

          if (!response.ok) {
            let errorMsg = 'Не удалось подключиться к серверу';
            let errorCode = '';
            try {
              const errData = await response.json();
              if (errData.error) { errorCode = errData.error; errorMsg = errData.error; }
            } catch (e) {}

            if (errorCode === 'Session expired') {
              errorMsg = 'Сессия истекла. Закройте приложение и откройте снова.';
            } else if (response.status === 401) {
              errorMsg = 'Ошибка проверки подписи Telegram. Перезапустите приложение.';
            } else if (response.status >= 500) {
              errorMsg = 'Сервер временно недоступен. Попробуйте через минуту.';
            }
            throw new Error(errorMsg);
          }

          const data = await response.json();
          setIsAuthenticated(true);
          setUserId(data.user_id);
        }
      } catch (err: any) {
        console.error("Telegram Auth Error:", err);
        setError(err.message || 'Ошибка инициализации');
      } finally {
        setIsLoading(false);
      }
    };

    authenticate();
  }, [setLanguage]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!isMounted || isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-space-dark relative overflow-hidden">
        <style>{`
          @keyframes spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
          .spin-slow { animation: spin 3s linear infinite; }
          .spin-rev  { animation: spin-reverse 1.5s linear infinite; }
        `}</style>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute w-full h-full border-4 border-t-transparent border-neon-cyan rounded-full spin-slow opacity-80 shadow-[0_0_15px_rgba(0,240,255,0.5)]" />
          <div className="absolute w-3/4 h-3/4 border-4 border-b-transparent border-blue-400 rounded-full spin-rev opacity-60" />
          <div className="absolute w-1/2 h-1/2 border-4 border-l-transparent border-white rounded-full animate-spin opacity-90" />
          <div className="font-mono text-neon-cyan font-bold tracking-widest animate-pulse text-sm">0101</div>
        </div>
        <h2 className="mt-8 text-sm font-bold tracking-[0.3em] font-orbitron uppercase text-neon-cyan animate-pulse drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
          SYNCING CLUB DATA...
        </h2>
        <p className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mt-3 opacity-60">
          Connecting to Telegram Secure Gateway...
        </p>
      </div>
    );
  }

  // ── Friendly error screen (no more "Access Denied"!) ─────────────────────
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-space-dark p-6 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border border-yellow-500/40 bg-yellow-500/10
                          flex items-center justify-center
                          shadow-[0_0_30px_rgba(234,179,8,0.25)]">
            <span className="text-3xl">⚠️</span>
          </div>
          <div className="absolute inset-0 rounded-full animate-ping border border-yellow-500/20"
               style={{ animationDuration: '2s' }} />
        </div>

        <h2 className="text-base font-black font-orbitron text-yellow-400 mb-2 uppercase tracking-wider">
          Ошибка подключения
        </h2>
        <p className="text-sm text-gray-400 mb-1 max-w-xs leading-relaxed">{error}</p>
        <p className="text-[10px] text-gray-600 mb-6 uppercase tracking-widest font-mono">
          FitManager · Connection Error
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs
                     bg-yellow-500/15 border border-yellow-500/40 text-yellow-300
                     hover:bg-yellow-500/25 hover:border-yellow-400/60
                     shadow-[0_0_15px_rgba(234,179,8,0.2)]
                     transition-all duration-200 active:scale-95"
        >
          🔄 Повторить
        </button>
        <p className="text-[9px] text-gray-700 mt-4 uppercase tracking-widest">
          Если проблема повторяется — перезапустите приложение
        </p>
      </div>
    );
  }

  return (
    <TelegramAuthContext.Provider value={{ isAuthenticated, userId, isLoading: false, error: null }}>
      {children}
    </TelegramAuthContext.Provider>
  );
}
