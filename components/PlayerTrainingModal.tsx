'use client';

import { useState, useEffect, useMemo } from 'react';
import { bulkTrainPlayer, healPlayerStamina } from '@/app/actions/playerActions';

interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

interface Player {
  id: string;
  name: string;
  age: number;
  ovr: number;
  potential_limit: number;
  position: string;
  stats: PlayerStats;
  stamina: number;
  is_injured?: boolean;
  injury_matches_left?: number;
  lineup_status: string;
}

interface PlayerTrainingModalProps {
  player: Player;
  userId: string;
  onClose: () => void;
  onTrainSuccess: (updatedPlayer: Player, newBalance: number) => void;
}

export function PlayerTrainingModal({ player, userId, onClose, onTrainSuccess }: PlayerTrainingModalProps) {
  const [trainingLevel, setTrainingLevel] = useState<number>(1);
  const [fancoins, setFancoins] = useState<number>(0);
  const [tpBalance, setTpBalance] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stagedStats, setStagedStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infraRes, userRes] = await Promise.all([
          fetch(`/api/infrastructure?userId=${userId}`),
          fetch(`/api/user/me?userId=${userId}`)
        ]);

        if (infraRes.ok && userRes.ok) {
          const infraData = await infraRes.json();
          const userData = await userRes.json();
          setTrainingLevel(infraData.infrastructure?.training_camp_level || 1);
          setFancoins(userData.user.balance_fancoins);
          setTpBalance(userData.user.balance_tp);
        }
      } catch (err) {
        console.error('Failed to fetch data for training modal');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [userId]);

  const discountPercent = Math.min(0.50, trainingLevel * 0.05);
  const trainCost = Math.floor(500 * (1 - discountPercent));

  const currentStats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
  
  const totalPointsAdded = Object.values(stagedStats).reduce((a, b) => a + b, 0);
  const stagedCost = totalPointsAdded * trainCost;
  const stagedStaminaCost = totalPointsAdded * 5;

  const projectedStats = useMemo(() => {
    return {
      pace: currentStats.pace + (stagedStats.pace || 0),
      shooting: currentStats.shooting + (stagedStats.shooting || 0),
      passing: currentStats.passing + (stagedStats.passing || 0),
      defending: currentStats.defending + (stagedStats.defending || 0),
      physical: currentStats.physical + (stagedStats.physical || 0),
    };
  }, [currentStats, stagedStats]);

  const projectedOvr = Math.floor(
    (projectedStats.pace + projectedStats.shooting + projectedStats.passing + projectedStats.defending + projectedStats.physical) / 5.0
  );

  const isMaxed = projectedOvr >= player.potential_limit;

  const handleIncrement = (key: keyof PlayerStats) => {
    if (fancoins < stagedCost + trainCost) {
      setErrorMsg('Insufficient FanCoins');
      return;
    }
    if (player.stamina < stagedStaminaCost + 5) {
      setErrorMsg('Not enough Stamina');
      return;
    }
    if (isMaxed) {
      setErrorMsg('Cannot exceed potential limit');
      return;
    }
    setErrorMsg(null);
    setStagedStats(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const handleDecrement = (key: keyof PlayerStats) => {
    setStagedStats(prev => {
      const current = prev[key] || 0;
      if (current <= 0) return prev;
      const next = { ...prev, [key]: current - 1 };
      if (next[key] === 0) delete next[key];
      return next;
    });
    setErrorMsg(null);
  };

  const handleCancel = () => {
    setStagedStats({});
    setErrorMsg(null);
  };

  const handleSaveBulk = async () => {
    if (totalPointsAdded === 0) return;
    setIsSaving(true);
    setErrorMsg(null);
    
    try {
      const res = await bulkTrainPlayer(userId, player.id, stagedStats);
      if (res.success) {
        setFancoins(res.newBalance ?? 0);
        window.dispatchEvent(new Event('balanceUpdated'));
        handleCancel();
        onTrainSuccess(res.player!, res.newBalance ?? 0);
      } else {
        setErrorMsg(res.error || 'Training failed');
      }
    } catch (err) {
      setErrorMsg('Network error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHeal = async () => {
    if (tpBalance < 50) {
      setErrorMsg('Insufficient Training Points');
      return;
    }

    setIsHealing(true);
    setErrorMsg(null);

    try {
      const res = await healPlayerStamina(userId, player.id);
      
      if (res.success) {
        setTpBalance(prev => prev - 50);
        window.dispatchEvent(new Event('balanceUpdated')); // Trigger global header update
        
        // Optimistically update player in parent component
        const updatedPlayer = { ...player, stamina: 100 };
        // We pass fancoins since it didn't change
        onTrainSuccess(updatedPlayer, fancoins);
      } else {
        setErrorMsg(res.error || 'Healing failed');
      }
    } catch (err) {
      setErrorMsg('Network error occurred.');
    } finally {
      setIsHealing(false);
    }
  };

  const statLabels: Record<keyof PlayerStats, string> = {
    pace: 'PAC',
    shooting: 'SHO',
    passing: 'PAS',
    defending: 'DEF',
    physical: 'PHY'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-gray-900 border-2 border-neon-cyan rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.3)] overflow-hidden flex flex-col relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-neon-pink transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-b from-neon-cyan/20 to-transparent p-5 text-center border-b border-neon-cyan/30">
          <div className="text-xs font-black text-neon-cyan mb-1 uppercase tracking-widest">{player.position}</div>
          <h2 className="text-xl font-bold text-white mb-2">{player.name}</h2>
          <div className="flex justify-center gap-4 text-sm font-orbitron">
            <div className="flex flex-col items-center">
              <span className="text-gray-500 text-[10px]">OVR</span>
              <div className="flex items-center gap-1">
                <span className={`text-xl font-black ${projectedOvr > player.ovr ? 'text-neon-green' : 'text-white'}`}>
                  {projectedOvr}
                </span>
                {projectedOvr > player.ovr && (
                  <span className="text-[10px] text-neon-green animate-pulse">+{projectedOvr - player.ovr}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-500 text-[10px]">POTENTIAL</span>
              <span className="text-xl font-black text-neon-pink">{player.potential_limit}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center bg-black/50 p-2 rounded border border-gray-800">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Balance</span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-neon-cyan">{isLoadingData ? '...' : fancoins.toLocaleString()} FC</span>
              {stagedCost > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-yellow-500 animate-pulse">⚡ -{stagedStaminaCost}</span>
                  <span className="text-[10px] text-red-400 animate-pulse">- {stagedCost.toLocaleString()} FC</span>
                </div>
              )}
            </div>
          </div>

          {/* Health Details */}
          <div className="flex justify-center items-center gap-4 mt-2">
            {player.is_injured && (
              <span className="text-xs bg-red-900/40 text-red-400 px-2 py-1 rounded border border-red-500/50 animate-pulse flex items-center gap-1">
                🚑 {player.injury_matches_left || 1}M
              </span>
            )}
            
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Stamina</span>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold ${player.stamina > 70 ? 'text-neon-green' : player.stamina > 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                  ⚡ {player.stamina}
                </span>
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden ml-1">
                  <div 
                    className={`h-full ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                    style={{ width: `${player.stamina}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-center font-bold text-neon-pink bg-red-900/20 p-2 rounded border border-neon-pink/30">
              {errorMsg}
            </div>
          )}

          {/* Medical Center / Healing */}
          {player.stamina < 100 && (
            <div className="flex flex-col gap-2 mb-2">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 border-b border-gray-800 pb-1">Medical Center</h3>
              <div className="flex justify-between items-center bg-black/50 p-2 rounded border border-gray-800">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Stamina</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                      <div className="h-full bg-orange-500 transition-all" style={{ width: `${player.stamina}%` }}></div>
                    </div>
                    <span className="text-xs font-mono text-orange-400">{player.stamina}/100</span>
                  </div>
                </div>
                <button
                  onClick={handleHeal}
                  disabled={tpBalance < 50 || isHealing}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    isHealing 
                      ? 'bg-transparent text-neon-green border-neon-green/50 opacity-50' 
                      : tpBalance >= 50 
                        ? 'bg-neon-green/10 text-neon-green border-neon-green hover:bg-neon-green hover:text-black shadow-[0_0_10px_rgba(57,255,20,0.3)]'
                        : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                  }`}
                >
                  {isHealing ? '...' : 'Heal (50 TP)'}
                </button>
              </div>
            </div>
          )}

          {isMaxed ? (
            <div className="text-center p-4 bg-green-900/20 border border-neon-green/30 rounded-lg">
              <span className="text-sm font-bold text-neon-green uppercase tracking-wider">Maximum Potential Reached</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 border-b border-gray-800 pb-1 flex justify-between">
                <span>Training Camp (Lvl {trainingLevel})</span>
                <span>{trainCost} FC / pt</span>
              </h3>
              
              {(Object.keys(statLabels) as Array<keyof PlayerStats>).map(key => {
                const added = stagedStats[key] || 0;
                const currentVal = player.stats[key] || 50;
                const projectedVal = currentVal + added;

                return (
                  <div key={key} className="flex items-center justify-between bg-black/40 p-2 rounded border border-gray-800 hover:border-neon-cyan/50 transition-colors">
                    <div className="flex items-center gap-3 w-1/3">
                      <span className="text-xs font-orbitron text-gray-400 w-8">{statLabels[key]}</span>
                      <span className={`text-sm font-black ${added > 0 ? 'text-neon-green' : 'text-white'}`}>
                        {projectedVal}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleDecrement(key)}
                        disabled={added === 0 || isSaving}
                        className={`w-8 h-8 rounded flex items-center justify-center font-bold text-lg transition-colors border ${
                          added > 0 ? 'bg-red-900/30 text-red-500 border-red-500 hover:bg-red-500 hover:text-white' : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                        }`}
                      >
                        -
                      </button>
                      <span className="text-xs font-mono w-4 text-center text-gray-400">{added > 0 ? `+${added}` : ''}</span>
                      <button 
                        onClick={() => handleIncrement(key)}
                        disabled={isMaxed || fancoins < stagedCost + trainCost || player.stamina < stagedStaminaCost + 5 || isSaving}
                        className={`w-8 h-8 rounded flex items-center justify-center font-bold text-lg transition-colors border ${
                          (!isMaxed && fancoins >= stagedCost + trainCost && player.stamina >= stagedStaminaCost + 5) ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan hover:bg-neon-cyan hover:text-black' : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
                <button
                  onClick={handleCancel}
                  disabled={totalPointsAdded === 0 || isSaving}
                  className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    totalPointsAdded > 0 ? 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700' : 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
                  }`}
                >
                  Отменить
                </button>
                <button
                  onClick={handleSaveBulk}
                  disabled={totalPointsAdded === 0 || player.stamina < stagedStaminaCost || isSaving}
                  className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    totalPointsAdded > 0 && player.stamina >= stagedStaminaCost && !isSaving ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan hover:bg-neon-cyan hover:text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? 'Saving...' : `Сохранить`}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
