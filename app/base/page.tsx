'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import Link from 'next/link';

interface Infrastructure {
  stadium_level: number;
  training_camp_level: number;
  medical_center_level: number;
}

export default function ClubBasePage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  
  const [infra, setInfra] = useState<Infrastructure | null>(null);
  const [fancoins, setFancoins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [upgradingBuilding, setUpgradingBuilding] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      try {
        const [infraRes, userRes] = await Promise.all([
          fetch(`/api/infrastructure?userId=${userId}`),
          fetch(`/api/user/me?userId=${userId}`)
        ]);
        
        if (infraRes.ok && userRes.ok) {
          const infraData = await infraRes.json();
          const userData = await userRes.json();
          setInfra(infraData.infrastructure);
          setFancoins(userData.user.balance_fancoins);
        }
      } catch (err) {
        console.error("Failed to fetch club base data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && userId) {
      fetchData();
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  const handleUpgrade = async (buildingType: 'stadium' | 'training_camp' | 'medical_center') => {
    if (!userId) return;
    setUpgradingBuilding(buildingType);
    setErrorMsg(null);
    
    try {
      const res = await fetch('/api/infrastructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, buildingType })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setInfra(data.infrastructure);
        setFancoins(data.new_balance);
      } else {
        setErrorMsg(data.error || 'Failed to upgrade');
      }
    } catch (err) {
      setErrorMsg('Network error occurred.');
    } finally {
      setUpgradingBuilding(null);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  if (!infra) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 bg-space-dark min-h-screen">
        <p className="text-neon-pink text-xl font-bold">Base Not Found</p>
        <Link href="/" className="px-5 py-3 bg-neon-cyan text-black font-black rounded mt-4 hover:bg-white transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const buildings: Array<{ type: 'stadium' | 'training_camp' | 'medical_center', key: string, name: string, desc: string }> = [
    { type: 'stadium', key: 'stadium_level', name: t.stadium, desc: t.stadium_desc },
    { type: 'training_camp', key: 'training_camp_level', name: t.training_camp, desc: t.training_camp_desc },
    { type: 'medical_center', key: 'medical_center_level', name: t.medical_center, desc: t.medical_center_desc }
  ];

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-12 bg-space-dark min-h-screen">
      <header className="flex justify-between items-end border-b border-gray-800 pb-2">
        <div>
          <Link href="/" className="text-xs text-neon-cyan hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">{t.club_base}</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">FanCoins</div>
          <div className="text-xl font-black text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">{fancoins.toLocaleString()}</div>
        </div>
      </header>
      
      {errorMsg && (
        <div className="p-3 bg-red-900/30 border border-neon-pink text-neon-pink text-sm text-center rounded-lg shadow-[0_0_10px_rgba(255,0,60,0.3)]">
          {errorMsg === 'Insufficient FanCoins' ? t.insufficient_fancoins : errorMsg}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {buildings.map(b => {
          const level = infra[b.key as keyof Infrastructure] as number;
          const upgradeCost = level * 1000;
          const canAfford = fancoins >= upgradeCost;
          const isUpgrading = upgradingBuilding === b.type;
          
          return (
            <div key={b.type} className="bg-black/60 backdrop-blur-md border border-gray-700 hover:border-neon-cyan/50 p-4 rounded-xl flex flex-col gap-3 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">{b.name}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-neon-green font-bold bg-green-900/40 px-2 py-0.5 rounded-sm">{t.level} {level}</span>
                </div>
                <div className="w-10 h-10 border border-gray-600 rounded bg-gray-900/80 flex items-center justify-center opacity-70">
                  <span className="text-gray-500 text-xs font-mono">IMG</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 leading-relaxed min-h-[36px]">
                {b.desc}
              </p>
              
              <button 
                onClick={() => handleUpgrade(b.type)}
                disabled={!canAfford || isUpgrading}
                className={`w-full mt-2 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 flex justify-between px-4 items-center ${
                  isUpgrading 
                    ? 'bg-gray-600 cursor-wait' 
                    : canAfford 
                      ? 'bg-neon-cyan/10 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                      : 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span>{isUpgrading ? '...' : t.upgrade}</span>
                <span className={`text-sm font-black ${!canAfford && !isUpgrading ? 'text-red-900' : ''}`}>
                  {upgradeCost.toLocaleString()} FC
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
