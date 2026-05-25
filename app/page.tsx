'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { FitnessSyncWidget } from '@/components/FitnessSyncWidget';
import { MatchHistoryWidget } from '@/components/MatchHistoryWidget';
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
  const [teamName, setTeamName] = useState<string | null>(null);
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
          setTeamName(teamJson.team.name);
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
      <header className="bg-black/60 border border-gray-800 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan flex items-center justify-center shadow-[0_0_10px_rgba(255,0,100,0.3)]">
            <Trophy className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-lg font-bold text-white tracking-wider uppercase ${headerFontClass}`}>
              {teamName || 'Manager Dashboard'}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Manager: <span className="text-neon-pink">{firstName}</span></p>
          </div>
        </div>
        <div>
          {userData?.wallet_address ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/80 border border-neon-green/30">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse"></div>
              <span className="text-[10px] font-mono text-neon-green">{shortenAddress(userData.wallet_address)}</span>
            </div>
          ) : (
            <div className="scale-75 origin-right opacity-80 hover:opacity-100 transition-opacity">
              <WalletConnect />
            </div>
          )}
        </div>
      </header>

      {/* MANAGER DASHBOARD */}
      <section className="flex flex-col gap-4 mt-2">
        {/* Match History Widget */}
        {userId && <MatchHistoryWidget userId={userId} teamName={teamName} />}

        {/* Team Status Card */}
        <Link 
          href="/base" 
          className="relative overflow-hidden group p-5 rounded-xl shadow-[0_4px_20px_rgba(0,240,255,0.15)] border border-neon-cyan/40 bg-gradient-to-r from-cyan-900/40 to-black/80 hover:border-neon-cyan transition-all active:scale-95 flex items-center justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/20 rounded-full blur-2xl group-hover:bg-neon-cyan/40 transition-all -mr-10 -mt-10" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="text-neon-cyan w-5 h-5" />
              <span className={`text-neon-cyan text-xs uppercase tracking-widest font-bold ${buttonFontClass}`}>{t.team_status}</span>
            </div>
            <h3 className={`text-white text-xl font-bold uppercase tracking-wider ${buttonFontClass}`}>
              {t.training_base}
            </h3>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
              {t.watch_stamina}
            </p>
          </div>
          <div className="bg-neon-cyan/10 p-3 rounded-full border border-neon-cyan/30 group-hover:bg-neon-cyan group-hover:text-black transition-colors text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)] relative z-10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>

        {/* League Mini-Card */}
        <Link 
          href="/league" 
          className="relative overflow-hidden group p-4 rounded-xl shadow-[0_4px_15px_rgba(188,19,254,0.15)] border border-neon-purple/40 bg-gradient-to-br from-purple-900/20 to-black/60 hover:border-neon-purple transition-all active:scale-95 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="bg-neon-purple/10 p-2 rounded-lg border border-neon-purple/30">
              <Trophy className="text-neon-purple w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-white font-bold uppercase tracking-wider text-sm ${buttonFontClass}`}>
                {t.league_standings}
              </h3>
              <p className="text-xs text-gray-500">{t.view_global_rankings}</p>
            </div>
          </div>
          <span className="text-gray-500 group-hover:text-neon-purple transition-colors relative z-10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </span>
        </Link>
      </section>

      {/* Secondary Actions */}
      <section className="flex flex-col gap-4 mt-1">
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
