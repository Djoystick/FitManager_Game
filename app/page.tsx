'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/TelegramAuthProvider';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { FitnessSyncWidget } from '@/components/FitnessSyncWidget';

interface UserData {
  wallet_address: string | null;
}

export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language];
  const headerFontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';
  const buttonFontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';

  const [userData, setUserData] = useState<UserData | null>(null);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [firstName, setFirstName] = useState('Manager');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@twa-dev/sdk').then((module) => {
        const WebApp = module.default;
        if (WebApp.initDataUnsafe?.user?.first_name) {
          setFirstName(WebApp.initDataUnsafe.user.first_name);
        }
      });
    }
  }, []);

  const fetchUserData = async (id: string) => {
    try {
      const [userRes, teamRes] = await Promise.all([
        fetch(`/api/user/me?userId=${id}`),
        fetch(`/api/team/my-team?userId=${id}`)
      ]);

      if (userRes.ok) {
        const json = await userRes.json();
        setUserData(json.user);
      }

      if (teamRes.ok) {
        setHasTeam(true);
      } else if (teamRes.status === 404) {
        setHasTeam(false);
      } else {
        setHasTeam(true); // Fallback to allow dashboard to render, or could handle error
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
      setHasTeam(true); // Fallback
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchUserData(userId);
    } else if (!isAuthLoading && !isAuthenticated) {
      // Allow the loading state to resolve if running outside Telegram
      setIsDataLoading(false); 
      setHasTeam(true); // mock having team outside telegram
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isAuthLoading || isDataLoading || hasTeam === null) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  if (hasTeam === false && userId) {
    return <OnboardingFlow userId={userId} onSuccess={() => fetchUserData(userId)} />;
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-8">
      {/* HEADER SECTION */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold text-white tracking-tight ${headerFontClass}`}>
            {t.welcome}, <span className="text-neon-pink">{firstName}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">{t.ready_to_manage}</p>
        </div>
        <div>
          {userData?.wallet_address ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-900/30 border border-neon-green/50 shadow-[0_0_10px_rgba(57,255,20,0.2)]">
              <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
              <span className="text-xs font-mono text-neon-green tracking-wider">{shortenAddress(userData.wallet_address)}</span>
            </div>
          ) : (
            <div className="scale-90 origin-right">
              <WalletConnect />
            </div>
          )}
        </div>
      </header>

      {/* NAVIGATION SECTION */}
      <section className="flex flex-col gap-3 mt-2">
        <Link href="/lineup" className={`w-full py-3 bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan text-center rounded-lg font-bold uppercase tracking-wider hover:bg-neon-cyan/20 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.1)] ${buttonFontClass}`}>
          {t.manage_tactics}
        </Link>
        <div className="flex gap-3">
          <Link href="/market" className={`flex-1 py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-cyan hover:text-neon-cyan transition-colors ${buttonFontClass}`}>
            {t.transfer_market}
          </Link>
          <Link href="/journal" className={`flex-1 py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-green hover:text-neon-green transition-colors ${buttonFontClass}`}>
            {t.match_journal}
          </Link>
        </div>
        <Link href="/base" className={`w-full py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-cyan hover:text-neon-cyan transition-colors ${buttonFontClass}`}>
          {t.club_base}
        </Link>
        <Link href="/profile" className={`w-full py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-pink hover:text-neon-pink transition-colors ${buttonFontClass}`}>
          {t.profile}
        </Link>
      </section>

      {/* FITNESS SYNC WIDGET SECTION */}
      <section className="mt-2 w-full">
        <FitnessSyncWidget />
      </section>
    </div>
  );
}
