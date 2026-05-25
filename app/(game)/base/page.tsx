'use client';

import React, { useContext, useEffect, useState } from 'react';
import { Hospital, Dumbbell, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { getInjuredPlayers, healPlayer, getStadiumData, upgradeStadium, forceInjuryDebug } from '@/app/actions/baseActions';
import toast from 'react-hot-toast';

export default function BaseDashboard() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  return (
    <div className="flex flex-col flex-1 p-4 gap-4 pb-24 h-full overflow-y-auto custom-scrollbar bg-space-dark">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4 mt-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Hospital className="text-neon-cyan" /> 
          {t.training_base}
        </h1>
      </header>

      <div className="flex flex-col gap-4">
        <StadiumFacilityCard t={t} />
        <MedicalWardCard t={t} />
        <TrainingCenterCard t={t} />
      </div>
    </div>
  );
}

function TrainingCenterCard({ t }: { t: any }) {
  return (
    <div className="bg-black/40 border border-gray-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-neon-cyan/50 transition-colors flex items-center justify-between">
      <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/10 rounded-full blur-2xl group-hover:bg-neon-cyan/20 transition-all -mr-10 -mt-10"></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 bg-cyan-900/30 rounded-lg flex items-center justify-center border border-neon-cyan/30 flex-shrink-0">
          <Dumbbell className="text-neon-cyan" size={24} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white font-orbitron uppercase tracking-widest">{t.training_center}</h2>
          <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
        </div>
      </div>
      
      <button className="relative z-10 text-[10px] bg-neon-cyan/10 text-neon-cyan px-3 py-1.5 rounded uppercase font-bold tracking-widest border border-neon-cyan/30 hover:bg-neon-cyan hover:text-black transition-colors">
        {t.enter_facility}
      </button>
    </div>
  );
}

function MedicalWardCard({ t }: { t: any }) {
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
      setInjuredPlayers(prev => prev.filter(p => p.id !== playerId));
      window.dispatchEvent(new Event('balanceUpdated'));
    } else {
      toast.error(res.error || "Failed to heal");
    }
    setHealingId(null);
  };

  const handleDebugInjury = async () => {
    if (!userId) return;
    const res = await forceInjuryDebug(userId);
    if (res.success) {
      toast.success(`Травма применена: ${res.playerName}`);
      fetchInjured();
    } else {
      toast.error(res.error || "Ошибка травмы");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-black/40 border border-gray-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-neon-pink/50 transition-colors flex items-center justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-neon-pink/10 rounded-full blur-2xl group-hover:bg-neon-pink/20 transition-all -mr-10 -mt-10"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-pink-900/30 rounded-lg flex items-center justify-center border border-neon-pink/30 flex-shrink-0">
            <Zap className="text-neon-pink" size={24} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-orbitron uppercase tracking-widest">{t.medical_center}</h2>
            <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-2">
          <span className="text-xs font-mono text-gray-500">
            {isLoading ? '...' : `${injuredPlayers.length} Injured`}
          </span>
          {process.env.NODE_ENV === 'development' && (
            <button 
              onClick={handleDebugInjury}
              className="text-[9px] px-2 py-1 bg-red-900/30 text-red-400 border border-red-500/30 rounded uppercase font-bold tracking-widest hover:bg-red-500 hover:text-white transition-colors"
            >
              🐛 DEBUG: Сломать ногу
            </button>
          )}
        </div>
      </div>

      {/* Injured Players List */}
      {!isLoading && injuredPlayers.length > 0 && (
        <div className="bg-black/30 border border-gray-800 rounded-lg p-3 flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-neon-pink uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t.injured_players}
          </h3>
          {injuredPlayers.map(player => (
            <div key={player.id} className="flex items-center justify-between bg-black/60 p-2 rounded border border-gray-800">
              <div>
                <p className="text-xs font-bold text-white">{player.name}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest">{player.position} • OVR {player.overall_rating}</p>
              </div>
              <button 
                onClick={() => handleHeal(player.id)}
                disabled={healingId === player.id}
                className={`text-[10px] px-3 py-1.5 rounded uppercase font-bold tracking-widest transition-colors ${
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

function StadiumFacilityCard({ t }: { t: any }) {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const [stadiumLevel, setStadiumLevel] = useState<number>(1);
  const [fancoins, setFancoins] = useState<any>(0);
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

  const upgradeCost = stadiumLevel * 1000;
  const currentIncome = stadiumLevel * 50;
  
  // Safe cast for Fancoins to avoid NaN
  const safeBalance = typeof fancoins === 'string' ? Number(fancoins.replace(/\D/g, '')) : Number(fancoins);

  const handleUpgrade = async () => {
    if (!userId) return;
    
    if (safeBalance < upgradeCost) {
      toast.error(`Не хватает FC! Баланс: ${safeBalance}, Цена: ${upgradeCost}`);
      return;
    }

    setIsUpgrading(true);
    const res = await upgradeStadium(userId);
    if (res.success) {
      setStadiumLevel(res.new_level ?? 1);
      setFancoins(res.new_balance ?? 0);
      toast.success(t.stadium_upgrade_success.replace('{level}', (res.new_level ?? 1).toString()));
      window.dispatchEvent(new Event('balanceUpdated'));
    } else {
      toast.error(res.error || t.stadium_upgrade_fail);
    }
    setIsUpgrading(false);
  };

  return (
    <div className="bg-black/40 border border-gray-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-yellow-500/50 transition-colors flex items-center justify-between">
      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all -mr-10 -mt-10"></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 bg-yellow-900/30 rounded-lg flex items-center justify-center border border-yellow-500/30 flex-shrink-0">
          <TrendingUp className="text-yellow-500" size={24} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white font-orbitron uppercase tracking-widest flex items-center gap-2">
            {t.stadium}
            <span className="text-[9px] text-yellow-500 bg-yellow-900/30 px-1 py-0.5 rounded border border-yellow-500/30">
              +{currentIncome} FC/m
            </span>
          </h2>
          <span className="text-xs font-mono text-gray-500">{t.level} {stadiumLevel}</span>
        </div>
      </div>
      
      <button 
        onClick={handleUpgrade}
        disabled={isUpgrading || isLoading}
        className={`relative z-10 text-[10px] px-3 py-1.5 rounded uppercase font-bold tracking-widest transition-colors ${
          isUpgrading || isLoading
            ? 'bg-yellow-900/50 text-yellow-500 border border-yellow-700 cursor-wait'
            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.2)]'
        }`}
      >
        {isUpgrading || isLoading ? '...' : `${upgradeCost} FC`}
      </button>
    </div>
  );
}
