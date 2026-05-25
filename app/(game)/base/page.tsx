'use client';

import React, { useContext, useEffect, useState } from 'react';
import { Hospital, Dumbbell, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { getInjuredPlayers, healPlayer, getStadiumData, upgradeStadium } from '@/app/actions/baseActions';
import toast from 'react-hot-toast';

export default function BaseDashboard() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar bg-space-dark">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4 mt-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Hospital className="text-neon-cyan" /> 
          {t.training_base}
        </h1>
        <p className="text-sm text-gray-400">{t.base_desc}</p>
      </header>

      <div className="flex flex-col gap-6">
        {/* Stadium Card */}
        <div className="bg-black/40 border border-gray-800 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-yellow-500/50 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all -mr-10 -mt-10"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 bg-yellow-900/30 rounded-lg flex items-center justify-center border border-yellow-500/30 flex-shrink-0 shadow-[inset_0_0_15px_rgba(234,179,8,0.2)]">
              <TrendingUp className="text-yellow-500" size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-widest mb-1">{t.stadium}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t.stadium_desc}
              </p>
              <StadiumFacility />
            </div>
          </div>
        </div>

        {/* Medical Center Card */}
        <div className="bg-black/40 border border-gray-800 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-neon-pink/50 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-pink/10 rounded-full blur-2xl group-hover:bg-neon-pink/20 transition-all -mr-10 -mt-10"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 bg-pink-900/30 rounded-lg flex items-center justify-center border border-neon-pink/30 flex-shrink-0 shadow-[inset_0_0_15px_rgba(255,0,100,0.2)]">
              <Zap className="text-neon-pink" size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-widest mb-1">{t.medical_center}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t.med_desc}
              </p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
                {/* Upgrade button removed in favor of MedicalWard logic for now, or just kept disabled */}
              </div>
            </div>
          </div>
          
          <MedicalWard />
        </div>

        {/* Training Center Card */}
        <div className="bg-black/40 border border-gray-800 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-neon-cyan/50 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/10 rounded-full blur-2xl group-hover:bg-neon-cyan/20 transition-all -mr-10 -mt-10"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 bg-cyan-900/30 rounded-lg flex items-center justify-center border border-neon-cyan/30 flex-shrink-0 shadow-[inset_0_0_15px_rgba(0,240,255,0.2)]">
              <Dumbbell className="text-neon-cyan" size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-widest mb-1">{t.training_center}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t.train_desc}
              </p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
                <button className="text-xs bg-neon-cyan/10 text-neon-cyan px-4 py-2 rounded uppercase font-bold tracking-widest border border-neon-cyan/30 hover:bg-neon-cyan hover:text-black transition-colors shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                  {t.enter_facility}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicalWard() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  
  const [injuredPlayers, setInjuredPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healingId, setHealingId] = useState<string | null>(null);

  const fetchInjured = async () => {
    if (!userId) return;
    setIsLoading(true);
    const res = await getInjuredPlayers(userId);
    if (res.success) {
      setInjuredPlayers(res.players || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchInjured();
    }
  }, [isAuthenticated, userId]);

  const handleHeal = async (playerId: string) => {
    if (!userId) return;
    setHealingId(playerId);
    
    const res = await healPlayer(userId, playerId);
    if (res.success) {
      // Remove player from local state
      setInjuredPlayers(prev => prev.filter(p => p.id !== playerId));
      // Optionally show a success toast here
    } else {
      alert(res.error || "Failed to heal");
    }
    
    setHealingId(null);
  };

  if (isLoading) {
    return <div className="mt-4 pt-4 border-t border-gray-800 text-center text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
        <AlertTriangle className="text-neon-pink w-4 h-4" />
        {t.injured_players}
      </h3>
      
      {injuredPlayers.length === 0 ? (
        <div className="bg-green-900/20 border border-neon-green/30 rounded p-3 text-center">
          <p className="text-neon-green text-xs font-bold uppercase tracking-widest">{t.all_healthy}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {injuredPlayers.map(player => (
            <div key={player.id} className="flex items-center justify-between bg-black/60 p-3 rounded border border-gray-800">
              <div>
                <p className="text-sm font-bold text-white">{player.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{player.position} • OVR {player.overall_rating}</p>
              </div>
              <button 
                onClick={() => handleHeal(player.id)}
                disabled={healingId === player.id}
                className={`text-xs px-3 py-1.5 rounded uppercase font-bold tracking-widest transition-colors ${
                  healingId === player.id 
                    ? 'bg-gray-800 text-gray-500 cursor-wait' 
                    : 'bg-neon-pink/10 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink hover:text-black shadow-[0_0_10px_rgba(255,0,100,0.2)]'
                }`}
              >
                {healingId === player.id ? '...' : t.heal_button}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StadiumFacility() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);

  const [stadiumLevel, setStadiumLevel] = useState<number>(1);
  const [fancoins, setFancoins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const fetchStadium = async () => {
    if (!userId) return;
    setIsLoading(true);
    const res = await getStadiumData(userId);
    if (res.success) {
      setStadiumLevel(res.stadium_level || 1);
      setFancoins(res.fancoins || 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchStadium();
    }
  }, [isAuthenticated, userId]);

  const handleUpgrade = async () => {
    if (!userId) return;
    setIsUpgrading(true);
    const res = await upgradeStadium(userId);
    if (res.success) {
      setStadiumLevel(res.new_level ?? 1);
      setFancoins(res.new_balance ?? 0);
      toast.success(t.stadium_upgrade_success.replace('{level}', (res.new_level ?? 1).toString()));
    } else {
      toast.error(res.error || t.stadium_upgrade_fail);
    }
    setIsUpgrading(false);
  };

  if (isLoading) {
    return <div className="mt-4 pt-4 border-t border-gray-800 text-center text-sm text-gray-500">Loading...</div>;
  }

  const upgradeCost = stadiumLevel * 1000;
  const currentIncome = stadiumLevel * 50;
  const canUpgrade = Number(fancoins) >= upgradeCost;

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-4">
        {t.stadium_income.replace('{amount}', currentIncome.toString())}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{t.level} {stadiumLevel}</span>
        <button 
          onClick={handleUpgrade}
          disabled={!canUpgrade || isUpgrading}
          className={`text-xs px-4 py-2 rounded uppercase font-bold tracking-widest transition-colors ${
            !canUpgrade 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
              : isUpgrading
                ? 'bg-yellow-900/50 text-yellow-500 border border-yellow-700 cursor-wait'
                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.2)]'
          }`}
        >
          {isUpgrading ? '...' : `${t.upgrade} (${upgradeCost} FC)`}
        </button>
      </div>
    </div>
  );
}
