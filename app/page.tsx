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
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Users, Trophy, User, Shield, Activity, Coins } from 'lucide-react';
import { getUnviewedMatch } from '@/app/actions/matchActions';
import { MatchReport } from '@/components/MatchReportModal';

interface UserData {
  wallet_address:   string | null;
  balance_fancoins: number;
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
  const [players, setPlayers] = useState<any[]>([]);
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
          setPlayers(teamJson.players || []);
        }
      } else {
        setHasTeam(true);
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
      setHasTeam(true);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchUserData(userId);
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsDataLoading(false); 
      setHasTeam(true); 
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isAuthLoading || isDataLoading || hasTeam === null) {
    return <CyberLoader fullScreen />;
  }

  if (hasTeam === false && userId) {
    return <OnboardingFlow userId={userId} onSuccess={() => fetchUserData(userId)} />;
  }

  const teamOvr = players.length ? Math.round(players.reduce((sum, p) => sum + (p.ovr || 0), 0) / players.length) : 0;
  const avgStamina = players.length ? Math.round(players.reduce((sum, p) => sum + (p.stamina || 0), 0) / players.length) : 0;

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* PREMIUM TOP BAR */}
      <header className="flex items-center justify-between bg-black/60 border border-gray-800 rounded-2xl p-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Clickable profile avatar */}
          <Link
            href="/profile"
            id="home-profile-btn"
            className="w-10 h-10 rounded-full bg-gray-900 border border-neon-cyan flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.3)] hover:border-neon-cyan/80 hover:shadow-[0_0_18px_rgba(0,240,255,0.5)] transition-all duration-200 active:scale-95"
          >
            <User className="text-neon-cyan w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className={`text-sm font-black text-white uppercase tracking-wider ${headerFontClass}`}>
              {teamName || 'Unknown Team'}
            </h1>
            <span className="text-[10px] text-gray-500 font-mono">@{firstName}</span>
          </div>
        </div>

        {/* Real FC balance from API */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-yellow-900/20 border border-yellow-600/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
          <Coins className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-xs font-black font-orbitron text-yellow-400">
            {(userData?.balance_fancoins ?? 0).toLocaleString()}
          </span>
        </div>
      </header>

      {/* TEAM STATUS WIDGET */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-black to-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)] group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-neon-cyan/5 rounded-full blur-2xl group-hover:bg-neon-cyan/10 transition-colors" />
          <Shield className="w-6 h-6 text-neon-cyan mb-2 opacity-80" />
          <span className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">{teamOvr}</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Team OVR</span>
        </div>

        <div className="bg-gradient-to-br from-black to-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)] group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-colors" />
          <Activity className="w-6 h-6 text-green-500 mb-2 opacity-80" />
          <span className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">{avgStamina}%</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Avg Stamina</span>
        </div>
      </section>

      {/* MATCH JOURNAL (RESTRICTED TO 3 ITEMS) */}
      <section className="bg-black/40 rounded-2xl p-2 border border-gray-800/50 shadow-inner">
        {userId && <MatchHistoryWidget userId={userId} teamName={teamName} />}
      </section>

      {/* FITNESS SYNC WIDGET SECTION */}
      <section className="mt-2 w-full animate-in fade-in slide-in-from-bottom-6 duration-700">
        <FitnessSyncWidget />
      </section>

    </div>
  );
}
