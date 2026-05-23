'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/TelegramAuthProvider';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';

interface UserData {
  balance_fancoins: number;
  balance_tp: number;
  wallet_address: string | null;
}

export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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
      const res = await fetch(`/api/user/me?userId=${id}`);
      if (res.ok) {
        const json = await res.json();
        setUserData(json.user);
      }
    } catch (error) {
      console.error("Failed to fetch user data", error);
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
    }
  }, [isAuthenticated, userId, isAuthLoading]);

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
          setSyncMessage(`Synced! Earned ${json.earned_tp} TP. (Daily Hard Cap Reached!)`);
        } else if (json.meta?.diminishingPenalty > 0) {
          setSyncMessage(`Synced! Earned ${json.earned_tp} TP. (-${json.meta.diminishingPenalty}% Diminishing Returns penalty)`);
        } else {
          setSyncMessage(`Synced securely! Earned ${json.earned_tp} TP.`);
        }
      } else {
        setSyncMessage(`Error: ${json.error || 'Failed to sync activity'}`);
      }
    } catch (error) {
      setSyncMessage('Failed to connect to backend servers.');
    } finally {
      setIsSyncing(false);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isAuthLoading || isDataLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-8">
      {/* HEADER SECTION */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome, <span className="text-neon-pink">{firstName}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Ready to manage your squad?</p>
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
          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">FanCoins</span>
          <span className="text-3xl font-black text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
            {userData?.balance_fancoins?.toLocaleString() || 0}
          </span>
        </div>

        {/* Training Points Card */}
        <div className="relative p-5 rounded-xl border border-neon-green/30 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col justify-center items-center shadow-[0_0_15px_rgba(57,255,20,0.05)] hover:shadow-[0_0_25px_rgba(57,255,20,0.2)] transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-neon-green/10 rounded-bl-full blur-xl"></div>
          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Training Pts</span>
          <span className="text-3xl font-black text-neon-green drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]">
            {userData?.balance_tp?.toLocaleString() || 0}
          </span>
        </div>
      </section>

      {/* NAVIGATION SECTION */}
      <section className="flex flex-col gap-3 mt-2">
        <Link href="/lineup" className="w-full py-3 bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan text-center rounded-lg font-bold uppercase tracking-wider hover:bg-neon-cyan/20 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.1)]">
          Manage Tactics & Lineup
        </Link>
        <div className="flex gap-3">
          <Link href="/market" className="flex-1 py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-cyan hover:text-neon-cyan transition-colors">
            Transfer Market
          </Link>
          <Link href="/journal" className="flex-1 py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg font-bold uppercase tracking-wider hover:border-neon-green hover:text-neon-green transition-colors">
            Match Journal
          </Link>
        </div>
      </section>

      {/* FITNESS SYNC WIDGET SECTION */}
      <section className="mt-2 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">Activity Synchronization</h2>
        
        <div className="bg-gradient-to-br from-gray-900 to-black p-5 rounded-xl border border-gray-800 shadow-lg flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-neon-pink/5 rounded-tl-full blur-2xl"></div>
          
          <p className="text-sm text-gray-400 relative z-10">
            Sync your real-world fitness metrics to earn TP. Use Training Points to upgrade your squad and dominate the league.
          </p>
          
          <button 
            onClick={handleSimulateRun}
            disabled={isSyncing || !isAuthenticated}
            className={`relative z-10 w-full py-3.5 rounded-lg font-bold text-black uppercase tracking-wider transition-all duration-300 ${
              isSyncing || !isAuthenticated
                ? 'bg-gray-600 cursor-not-allowed opacity-70'
                : 'bg-neon-pink hover:bg-white hover:text-neon-pink hover:shadow-[0_0_20px_rgba(255,0,60,0.6)] shadow-[0_0_10px_rgba(255,0,60,0.4)]'
            }`}
          >
            {isSyncing ? 'Syncing Hardware...' : 'Simulate 30m Run'}
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
