'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/TelegramAuthProvider';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';

interface UserData {
  balance_fancoins: number;
  balance_tp: number;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [teamNameInput, setTeamNameInput] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

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

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !teamNameInput.trim()) return;
    
    setIsCreatingTeam(true);
    try {
      const res = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, teamName: teamNameInput.trim() }),
      });
      
      if (res.ok) {
        await fetchUserData(userId);
      } else {
        const err = await res.json();
        console.error("Failed to create team:", err);
      }
    } catch (error) {
      console.error("Failed to create team:", error);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleSimulateRun = async () => {
    if (!userId) return;
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/fitness/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          activityType: 'Running',
          durationMinutes: 30,
          calories: 350,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Optimistically update the local TP balance
        setUserData(prev => prev ? { ...prev, balance_tp: json.balance_tp } : prev);
        
        // Render anti-cheat feedback elegantly
        if (json.meta?.dailyLimitReached) {
          setSyncMessage(t.synced_daily_limit.replace('{tp}', json.earned_tp));
        } else if (json.meta?.diminishingPenalty > 0) {
          setSyncMessage(t.synced_penalty.replace('{tp}', json.earned_tp).replace('{penalty}', json.meta.diminishingPenalty));
        } else {
          setSyncMessage(t.synced_earned.replace('{tp}', json.earned_tp));
        }
      } else {
        setSyncMessage(t.sync_error.replace('{error}', json.error || 'Failed to sync activity'));
      }
    } catch (error) {
      setSyncMessage(t.failed_connect);
    } finally {
      setIsSyncing(false);
    }
  };

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

  if (hasTeam === false) {
    return (
      <div className="flex flex-col flex-1 p-6 gap-8 justify-center min-h-screen bg-space-dark">
        <div className="bg-black/60 backdrop-blur-md p-8 rounded-2xl border border-neon-pink/50 shadow-[0_0_30px_rgba(255,0,60,0.2)]">
          <h1 className={`text-3xl font-bold text-white mb-2 text-center ${headerFontClass}`}>Create Your Franchise</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">Draft your initial squad and begin your journey to the top of the league.</p>
          
          <form onSubmit={handleCreateTeam} className="flex flex-col gap-5">
            <div>
              <label className="text-xs text-neon-cyan uppercase tracking-widest font-bold mb-2 block">Franchise Name</label>
              <input 
                type="text" 
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="e.g. Cyber Punks FC"
                required
                maxLength={30}
                className="w-full bg-black/50 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isCreatingTeam || !teamNameInput.trim()}
              className={`w-full py-4 rounded-lg font-bold text-black uppercase tracking-wider transition-all duration-300 mt-2 ${buttonFontClass} ${
                isCreatingTeam || !teamNameInput.trim()
                  ? 'bg-gray-600 cursor-not-allowed opacity-70'
                  : 'bg-neon-cyan hover:bg-white hover:text-neon-cyan hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] shadow-[0_0_10px_rgba(0,240,255,0.4)]'
              }`}
            >
              {isCreatingTeam ? 'Drafting Players...' : 'Found Club'}
            </button>
          </form>
        </div>
      </div>
    );
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

      {/* ECONOMY GRID SECTION */}
      <section className="grid grid-cols-2 gap-4">
        {/* FanCoins Card */}
        <div className="relative p-5 rounded-xl border border-neon-cyan/30 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col justify-center items-center shadow-[0_0_15px_rgba(0,240,255,0.05)] hover:shadow-[0_0_25px_rgba(0,240,255,0.2)] transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-cyan/10 rounded-bl-full blur-xl"></div>
          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">{t.fancoins}</span>
          <span className="text-3xl font-black text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] font-orbitron">
            {userData?.balance_fancoins?.toLocaleString() || 0}
          </span>
        </div>

        {/* Training Points Card */}
        <div className="relative p-5 rounded-xl border border-neon-green/30 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col justify-center items-center shadow-[0_0_15px_rgba(57,255,20,0.05)] hover:shadow-[0_0_25px_rgba(57,255,20,0.2)] transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-green/10 rounded-bl-full blur-xl"></div>
          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">{t.training_pts}</span>
          <span className="text-3xl font-black text-neon-green drop-shadow-[0_0_8px_rgba(57,255,20,0.8)] font-orbitron">
            {userData?.balance_tp?.toLocaleString() || 0}
          </span>
        </div>
      </section>

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
        <Link href="/profile" className={`w-full py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-pink hover:text-neon-pink transition-colors ${buttonFontClass}`}>
          {t.profile}
        </Link>
      </section>

      {/* FITNESS SYNC WIDGET SECTION */}
      <section className="mt-2 flex flex-col gap-4">
        <h2 className={`text-lg font-bold text-white border-b border-gray-800 pb-2 ${headerFontClass}`}>{t.activity_sync}</h2>
        
        <div className="bg-gradient-to-br from-gray-900 to-black p-5 rounded-xl border border-gray-800 shadow-lg flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-neon-pink/5 rounded-tl-full blur-2xl"></div>
          
          <p className="text-sm text-gray-400 relative z-10">
            {t.sync_desc}
          </p>
          
          <button 
            onClick={handleSimulateRun}
            disabled={isSyncing || !isAuthenticated}
            className={`relative z-10 w-full py-3.5 rounded-lg font-bold text-black uppercase tracking-wider transition-all duration-300 ${buttonFontClass} ${
              isSyncing || !isAuthenticated
                ? 'bg-gray-600 cursor-not-allowed opacity-70'
                : 'bg-neon-pink hover:bg-white hover:text-neon-pink hover:shadow-[0_0_20px_rgba(255,0,60,0.6)] shadow-[0_0_10px_rgba(255,0,60,0.4)]'
            }`}
          >
            {isSyncing ? t.syncing_hardware : t.simulate_run}
          </button>

          {syncMessage && (
            <div className={`relative z-10 p-3 rounded bg-black/50 text-sm text-center border font-medium ${syncMessage.includes('Error') ? 'text-red-400 border-red-900/50' : 'text-neon-green border-neon-green/30'}`}>
              {syncMessage}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
