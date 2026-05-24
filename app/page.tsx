'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { FitnessSyncWidget } from '@/components/FitnessSyncWidget';
import { Users, Trophy, ShoppingCart, Building2, User, BookOpen } from 'lucide-react';

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
        const teamJson = await teamRes.json();
        if (!teamJson.team) {
          setHasTeam(false);
        } else {
          setHasTeam(true);
        }
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

      {/* CONTROL CENTER */}
      <section className="grid grid-cols-2 gap-4 mt-2">
        {/* Squad Card */}
        <Link 
          href="/lineup" 
          className="relative overflow-hidden group p-4 rounded-xl shadow-[0_4px_15px_rgba(0,240,255,0.1)] border border-neon-cyan/40 bg-gradient-to-br from-blue-900/40 to-black/80 hover:border-neon-cyan transition-all active:scale-95"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-cyan/20 rounded-full blur-xl group-hover:bg-neon-cyan/40 transition-all" />
          <Users className="text-neon-cyan w-8 h-8 mb-3" />
          <h3 className={`text-white font-bold uppercase tracking-wider ${buttonFontClass}`}>
            ⚽ Squad
          </h3>
          <p className="text-xs text-gray-400 mt-1">Manage Tactics</p>
        </Link>

        {/* League Card */}
        <Link 
          href="/league" 
          className="relative overflow-hidden group p-4 rounded-xl shadow-[0_4px_15px_rgba(188,19,254,0.15)] border border-neon-purple/40 bg-gradient-to-br from-purple-900/40 to-black/80 hover:border-neon-purple transition-all active:scale-95"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-purple/20 rounded-full blur-xl group-hover:bg-neon-purple/40 transition-all" />
          <Trophy className="text-neon-purple w-8 h-8 mb-3 drop-shadow-[0_0_8px_rgba(188,19,254,0.6)]" />
          <h3 className={`text-white font-bold uppercase tracking-wider ${buttonFontClass}`}>
            🏆 League
          </h3>
          <p className="text-xs text-gray-400 mt-1">Pro Standings</p>
        </Link>

        {/* Market Card */}
        <Link 
          href="/market" 
          className="relative overflow-hidden group p-4 rounded-xl shadow-[0_4px_15px_rgba(57,255,20,0.1)] border border-neon-green/40 bg-gradient-to-br from-green-900/40 to-black/80 hover:border-neon-green transition-all active:scale-95"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-green/20 rounded-full blur-xl group-hover:bg-neon-green/40 transition-all" />
          <ShoppingCart className="text-neon-green w-8 h-8 mb-3" />
          <h3 className={`text-white font-bold uppercase tracking-wider ${buttonFontClass}`}>
            🛒 Market
          </h3>
          <p className="text-xs text-gray-400 mt-1">Transfers</p>
        </Link>

        {/* Base Card (Coming Soon) */}
        <div className="relative overflow-hidden p-4 rounded-xl shadow-md border border-gray-700 bg-gray-900/40 opacity-60 cursor-not-allowed">
          <Building2 className="text-gray-500 w-8 h-8 mb-3" />
          <h3 className={`text-gray-400 font-bold uppercase tracking-wider ${buttonFontClass}`}>
            🏗️ Base
          </h3>
          <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold text-neon-pink/70">Coming Soon</p>
        </div>
      </section>

      {/* Secondary Actions */}
      <section className="grid grid-cols-2 gap-4 mt-1">
        <Link href="/journal" className="flex items-center justify-center gap-2 p-3 rounded-lg border border-gray-800 bg-black/40 hover:bg-gray-900 hover:border-gray-700 transition-colors active:scale-95 text-gray-400 hover:text-white">
          <BookOpen size={16} />
          <span className={`text-xs uppercase font-bold tracking-widest ${buttonFontClass}`}>Journal</span>
        </Link>
        <Link href="/profile" className="flex items-center justify-center gap-2 p-3 rounded-lg border border-gray-800 bg-black/40 hover:bg-gray-900 hover:border-gray-700 transition-colors active:scale-95 text-gray-400 hover:text-white">
          <User size={16} />
          <span className={`text-xs uppercase font-bold tracking-widest ${buttonFontClass}`}>Profile</span>
        </Link>
      </section>

      {/* FITNESS SYNC WIDGET SECTION */}
      <section className="mt-2 w-full">
        <FitnessSyncWidget />
      </section>
    </div>
  );
}
