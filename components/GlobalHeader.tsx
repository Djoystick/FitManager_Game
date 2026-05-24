'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

interface UserData {
  balance_fancoins: number;
  balance_tp: number;
}

export function GlobalHeader() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const [userData, setUserData] = useState<UserData | null>(null);
  const [animatingFC, setAnimatingFC] = useState(false);
  const [animatingTP, setAnimatingTP] = useState(false);

  const fetchBalances = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/me?userId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        
        // Trigger animations if balances changed
        if (userData && json.user.balance_fancoins !== userData.balance_fancoins) {
          setAnimatingFC(true);
          setTimeout(() => setAnimatingFC(false), 500);
        }
        if (userData && json.user.balance_tp !== userData.balance_tp) {
          setAnimatingTP(true);
          setTimeout(() => setAnimatingTP(false), 500);
        }

        setUserData(json.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchBalances();
    }
    
    // Listen for custom balance update events
    const handleBalanceUpdate = () => fetchBalances();
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate);
  }, [isAuthenticated, userId]);

  if (!isAuthenticated || !userId) return null;

  return (
    <div className="w-full bg-black/80 backdrop-blur-md border-b border-gray-800 p-3 flex justify-between items-center z-50 sticky top-0 shadow-[0_5px_20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-4 w-full justify-around">
        {/* FanCoins */}
        <div className={`flex items-center gap-2 transition-transform duration-300 ${animatingFC ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-300 ${animatingFC ? 'bg-yellow-400 border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,1)]' : 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]'}`}>
             <span className={`text-[10px] font-black transition-colors ${animatingFC ? 'text-black' : 'text-yellow-500'}`}>FC</span>
          </div>
          <span className={`text-xl font-black font-orbitron transition-all duration-300 ${animatingFC ? 'text-yellow-300 drop-shadow-[0_0_15px_rgba(250,204,21,1)]' : 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]'}`}>
            {userData?.balance_fancoins?.toLocaleString() || 0}
          </span>
        </div>
        
        <div className="h-6 w-px bg-gray-700"></div>

        {/* Training Points */}
        <div className={`flex items-center gap-2 transition-transform duration-300 ${animatingTP ? 'scale-110' : 'scale-100'}`}>
          <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors duration-300 ${animatingTP ? 'bg-neon-cyan border-white shadow-[0_0_20px_rgba(0,240,255,1)]' : 'bg-neon-cyan/20 border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]'}`}>
             <span className={`text-[10px] font-black transition-colors ${animatingTP ? 'text-black' : 'text-neon-cyan'}`}>TP</span>
          </div>
          <span className={`text-xl font-black font-orbitron transition-all duration-300 ${animatingTP ? 'text-white drop-shadow-[0_0_15px_rgba(0,240,255,1)]' : 'text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]'}`}>
            {userData?.balance_tp?.toLocaleString() || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
