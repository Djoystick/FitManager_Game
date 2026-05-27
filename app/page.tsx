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
import { Users, Trophy, ShoppingCart, Building2, User, BookOpen } from 'lucide-react';
import { getUnviewedMatch } from '@/app/actions/matchActions';
import { MatchReportModal, MatchReport } from '@/components/MatchReportModal';

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
  const [unviewedMatch, setUnviewedMatch] = useState<MatchReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUserTeamId, setModalUserTeamId] = useState<string>('');

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

  const handleMatchClick = (match: MatchReport, teamId: string) => {
    setModalUserTeamId(teamId);
    setUnviewedMatch(match);
  };

  const [hasUnviewedMatch, setHasUnviewedMatch] = useState(false);

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchUserData(userId);
      console.log('Checking for unviewed matches...');
      getUnviewedMatch(userId).then(res => {
        if (res.success && res.data) {
          console.log('Found unviewed match:', res.data);
          setHasUnviewedMatch(true);
        } else {
          setHasUnviewedMatch(false);
        }
      }).catch(err => {
        console.error('getUnviewedMatch failed:', err);
      });
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
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Match History Widget */}
        <div className="md:col-span-2 bg-black/20 rounded-xl p-2 border border-gray-800/50 shadow-inner">
          {userId && <MatchHistoryWidget userId={userId} teamName={teamName} />}
        </div>

        {/* Team Status Card */}
        <Link 
          href="/base" 
          className="relative overflow-hidden group p-5 rounded-xl shadow-[0_4px_20px_rgba(0,240,255,0.15)] border border-neon-cyan/40 bg-gradient-to-br from-cyan-950/80 to-black hover:border-neon-cyan transition-all active:scale-95 flex flex-col justify-between min-h-[140px]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 rounded-full blur-3xl group-hover:bg-neon-cyan/30 transition-all -mr-10 -mt-10" />
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 mb-2">
              <Users className="text-neon-cyan w-5 h-5" />
              <span className={`text-neon-cyan text-[10px] uppercase tracking-widest font-bold ${buttonFontClass}`}>{t.team_status}</span>
            </div>
            <div className="bg-neon-cyan/10 p-2 rounded-full border border-neon-cyan/30 group-hover:bg-neon-cyan group-hover:text-black transition-colors text-neon-cyan relative z-10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div>
            <h3 className={`text-white text-lg font-bold uppercase tracking-wider ${buttonFontClass} drop-shadow-[0_0_5px_rgba(0,240,255,0.3)]`}>
              {t.training_base}
            </h3>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
              {t.watch_stamina}
            </p>
          </div>
        </Link>

        {/* League Mini-Card */}
        <Link 
          href="/league" 
          className="relative overflow-hidden group p-5 rounded-xl shadow-[0_4px_15px_rgba(188,19,254,0.15)] border border-neon-purple/40 bg-gradient-to-br from-purple-950/80 to-black hover:border-neon-purple transition-all active:scale-95 flex flex-col justify-between min-h-[140px]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/10 rounded-full blur-3xl group-hover:bg-neon-purple/30 transition-all -mr-10 -mt-10" />
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <Trophy className="text-neon-purple w-5 h-5" />
               <span className={`text-neon-purple text-[10px] uppercase tracking-widest font-bold ${buttonFontClass}`}>Ranking</span>
            </div>
            <div className="text-gray-500 group-hover:text-neon-purple transition-colors bg-neon-purple/5 group-hover:bg-neon-purple/20 p-2 rounded-full border border-transparent group-hover:border-neon-purple/50 relative z-10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div className="relative z-10">
            <h3 className={`text-white text-lg font-bold uppercase tracking-wider ${buttonFontClass} drop-shadow-[0_0_5px_rgba(188,19,254,0.3)]`}>
              {t.league_standings}
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {t.view_global_rankings}
            </p>
          </div>
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

      {isModalOpen && unviewedMatch && (
        <MatchReportModal
          report={unviewedMatch}
          userTeamId={modalUserTeamId}
          onClose={() => {
            setIsModalOpen(false);
            setUnviewedMatch(null);
          }}
        />
      )}
    </div>
  );
}
