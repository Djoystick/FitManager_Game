'use client';

import { useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

interface UserData {
  balance_fancoins:  number;
  sweat_points:      number;
  cardio_coin:       number;
  fitness_coin:      number;
  ball_coin:         number;
  strength_coin:     number;
  balance_ton:       number;
}

export function GlobalHeader() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const pathname = usePathname();
  const t = dict[language as keyof typeof dict];
  const [userData, setUserData] = useState<UserData | null>(null);
  const [animatingFC, setAnimatingFC] = useState(false);
  const [animatingSP, setAnimatingSP] = useState(false);

  const fetchBalances = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/me?userId=${userId}`);
      if (!res.ok) return;
      const json = await res.json();
      const next: UserData = json.user;

      if (userData) {
        if (next.balance_fancoins !== userData.balance_fancoins) {
          setAnimatingFC(true);
          setTimeout(() => setAnimatingFC(false), 500);
        }
        if (next.sweat_points !== userData.sweat_points) {
          setAnimatingSP(true);
          setTimeout(() => setAnimatingSP(false), 500);
        }
      }
      setUserData(next);
    } catch (e) {
      console.error('[GlobalHeader] fetchBalances error:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) fetchBalances();
    const handleBalanceUpdate = () => fetchBalances();
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  if (!isAuthenticated || !userId || pathname === '/onboarding') return null;

  const fc = userData?.balance_fancoins ?? 0;
  const sp = userData?.sweat_points     ?? 0;


  return (
    <div className="w-full bg-black/85 backdrop-blur-md border-b border-gray-800/70 px-3 py-2 sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">

      {/* Row 1: Currencies */}
      <div className="flex items-center justify-evenly pb-1">
        
        {/* TON */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <div className="w-5 h-5 rounded-full border border-blue-600 bg-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.3)] flex items-center justify-center">
            <span className="text-[10px] text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]">💎</span>
          </div>
          <span className="text-sm font-black font-orbitron text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.7)]">
            {Number(userData?.balance_ton ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-gray-700/60 mx-2 shrink-0" />

        {/* FanCoins */}
        <div className={`flex items-center gap-1.5 shrink-0 transition-transform duration-300 ${animatingFC ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${
            animatingFC
              ? 'bg-yellow-400 border-yellow-300 shadow-[0_0_16px_rgba(250,204,21,1)]'
              : 'bg-yellow-500/20 border-yellow-600 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
          }`}>
            <span className={`text-[8px] font-black ${animatingFC ? 'text-black' : 'text-yellow-500'}`}>FC</span>
          </div>
          <span className={`text-base font-black font-orbitron transition-all duration-300 ${
            animatingFC
              ? 'text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,1)]'
              : 'text-yellow-500 drop-shadow-[0_0_4px_rgba(234,179,8,0.7)]'
          }`}>
            {fc.toLocaleString()}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-gray-700/60 mx-2 shrink-0" />

        {/* Sweat Points */}
        <div className={`flex items-center gap-1.5 transition-transform duration-300 ${animatingSP ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${
            animatingSP
              ? 'bg-neon-cyan border-white shadow-[0_0_16px_rgba(0,240,255,1)]'
              : 'bg-neon-cyan/20 border-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.3)]'
          }`}>
            <span className={`text-[8px] font-black ${animatingSP ? 'text-black' : 'text-neon-cyan'}`}>SP</span>
          </div>
          <span className={`text-base font-black font-orbitron transition-all duration-300 ${
            animatingSP
              ? 'text-white drop-shadow-[0_0_12px_rgba(0,240,255,1)]'
              : 'text-neon-cyan drop-shadow-[0_0_4px_rgba(0,240,255,0.7)]'
          }`}>
            {sp.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
