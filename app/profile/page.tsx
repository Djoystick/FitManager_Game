'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';

interface UserData {
  wallet_address: string | null;
}

export default function ProfilePage() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language, setLanguage } = useContext(LanguageContext);
  const t = dict[language];
  const fontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tgUser, setTgUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@twa-dev/sdk').then((module) => {
        const WebApp = module.default;
        if (WebApp.initDataUnsafe?.user) {
          setTgUser(WebApp.initDataUnsafe.user);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      const fetchUserData = async () => {
        try {
          const res = await fetch(`/api/user/me?userId=${userId}`);
          if (res.ok) {
            const json = await res.json();
            setUserData(json.user);
          }
        } catch (error) {
          console.error("Failed to fetch user data", error);
        }
      };
      fetchUserData();
    }
  }, [isAuthenticated, userId]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 overflow-y-auto">
      {/* HEADER */}
      <header className="flex items-center gap-4">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg hover:border-neon-cyan transition-colors">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className={`text-2xl font-bold text-white tracking-tight ${fontClass}`}>
          {t.user_profile}
        </h1>
      </header>

      {/* USER INFO CARD */}
      <section className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-neon-cyan/40 shadow-[0_0_15px_rgba(0,240,255,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-cyan to-blue-600 flex items-center justify-center border-2 border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)] flex-shrink-0">
            <span className="text-2xl font-black text-black font-orbitron">
              {tgUser?.first_name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-lg font-bold text-white ${fontClass}`}>
              {tgUser?.first_name} {tgUser?.last_name}
            </span>
            {tgUser?.username && (
              <span className="text-neon-cyan text-sm">@{tgUser.username}</span>
            )}
            <span className="text-gray-500 text-xs mt-1 font-mono">
              {t.id}: {tgUser?.id || userId || 'Unknown'}
            </span>
          </div>
        </div>
      </section>

      {/* WEB3 STATUS CARD */}
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-3">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold ${fontClass}`}>{t.wallet}</h2>
        {userData?.wallet_address ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/20 border border-neon-green/30">
            <div className="w-3 h-3 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.8)]"></div>
            <span className="font-mono text-neon-green tracking-wider">{shortenAddress(userData.wallet_address)}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-red-900/20 border border-neon-pink/30">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neon-pink shadow-[0_0_8px_rgba(255,0,60,0.8)]"></div>
              <span className={`text-neon-pink text-sm ${fontClass}`}>{t.not_connected}</span>
            </div>
            <WalletConnect />
          </div>
        )}
      </section>

      {/* SETTINGS / LANGUAGE TOGGLE */}
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-4">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold ${fontClass}`}>{t.language}</h2>
        <div className="flex gap-2 p-1 bg-gray-900 rounded-lg border border-gray-700">
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
              language === 'en' 
                ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.english}
          </button>
          <button
            onClick={() => setLanguage('ru')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
              language === 'ru' 
                ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.russian}
          </button>
        </div>
      </section>
      
      <Link href="/" className={`mt-auto w-full py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg uppercase tracking-wider hover:border-white hover:text-white transition-colors ${fontClass}`}>
        {t.back_to_dashboard}
      </Link>
    </div>
  );
}
