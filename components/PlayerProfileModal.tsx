'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, Zap, Dumbbell, User, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { bulkTrainPlayer, healPlayerStamina } from '@/app/actions/playerActions';
import { InfoPopover } from '@/components/ui/InfoPopover';

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
  stamina: number;
  stats: PlayerStats;
  traits?: string[];
  is_injured?: boolean;
  injury_matches_left?: number;
  lineup_status: string;
}

interface Props {
  player: Player;
  userId: string;
  onClose: () => void;
  onTrainSuccess: (updatedPlayer: Player, newBalance: number) => void;
}

export function PlayerProfileModal({ player, userId, onClose, onTrainSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'training'>('profile');
  
  // Training states
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

  const stats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
  
  const discountPercent = Math.min(0.50, trainingLevel * 0.05);
  const trainCost = Math.floor(500 * (1 - discountPercent));

  const totalPointsAdded = Object.values(stagedStats).reduce((a, b) => a + b, 0);
  const stagedCost = totalPointsAdded * trainCost;
  const stagedStaminaCost = totalPointsAdded * 5;

  const projectedStats = useMemo(() => {
    return {
      pace: stats.pace + (stagedStats.pace || 0),
      shooting: stats.shooting + (stagedStats.shooting || 0),
      passing: stats.passing + (stagedStats.passing || 0),
      defending: stats.defending + (stagedStats.defending || 0),
      physical: stats.physical + (stagedStats.physical || 0),
    };
  }, [stats, stagedStats]);

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
        window.dispatchEvent(new Event('balanceUpdated'));
        const updatedPlayer = { ...player, stamina: 100 };
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

  const statColors: Record<keyof PlayerStats, string> = {
    pace: 'bg-neon-cyan',
    shooting: 'bg-neon-pink',
    passing: 'bg-yellow-400',
    defending: 'bg-blue-500',
    physical: 'bg-green-500'
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-gray-950 border border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,255,0.15)] rounded-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Header (Always Visible) */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-start bg-gradient-to-b from-neon-cyan/10 to-transparent flex-shrink-0">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-xl bg-black/60 border border-neon-cyan/40 shadow-[inset_0_0_15px_rgba(0,255,255,0.2)] flex flex-col items-center justify-center">
              <span className={`text-2xl font-black ${projectedOvr > player.ovr ? 'text-neon-green' : 'text-white'}`}>
                {projectedOvr}
              </span>
              <span className="text-[10px] font-bold text-neon-cyan uppercase">{player.position}</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                {player.name}
                {player.is_injured && (
                  <span className="text-[10px] bg-red-900/40 text-red-400 px-1 py-0.5 rounded border border-red-500/50 animate-pulse">
                    🚑 {player.injury_matches_left}M
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Activity size={12} className={player.stamina > 50 ? 'text-neon-green' : 'text-red-500'} />
                  <span>Stamina: {player.stamina}%</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-orbitron">
                  <span>POTENTIAL:</span>
                  <span className="text-neon-pink font-bold">{player.potential_limit}</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors bg-black/40 rounded-full border border-gray-800 hover:border-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              activeTab === 'profile' ? 'text-neon-cyan bg-neon-cyan/10 border-b-2 border-neon-cyan' : 'text-gray-500 hover:text-gray-300 bg-black/40'
            }`}
          >
            <User size={14} /> Profile
          </button>
          <button
            onClick={() => setActiveTab('training')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              activeTab === 'training' ? 'text-neon-pink bg-neon-pink/10 border-b-2 border-neon-pink' : 'text-gray-500 hover:text-gray-300 bg-black/40'
            }`}
          >
            <Dumbbell size={14} /> Training
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-5">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col gap-5"
              >
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                    <Zap size={12} className="text-neon-pink" /> Detailed Stats
                    <InfoPopover 
                      title="Характеристики"
                      content={
                        <div className="space-y-2">
                          <p><strong className="text-neon-cyan">PAC:</strong> Скорость игрока. Влияет на перемещение по полю.</p>
                          <p><strong className="text-neon-pink">SHO:</strong> Удары. Точность и сила ударов по воротам.</p>
                          <p><strong className="text-yellow-400">PAS:</strong> Пасы. Успешность передач и видение поля.</p>
                          <p><strong className="text-blue-500">DEF:</strong> Защита. Отбор мяча и перехваты.</p>
                          <p><strong className="text-green-500">PHY:</strong> Физика. Выносливость и игра корпусом.</p>
                        </div>
                      }
                    />
                  </h3>
                  <div className="flex flex-col gap-3">
                    {(Object.keys(statLabels) as Array<keyof PlayerStats>).map(key => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-300 w-12 uppercase tracking-wider">{statLabels[key]}</span>
                        <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                          <div className={`h-full ${statColors[key]} transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(0, stats[key]))}%` }} />
                        </div>
                        <span className="text-xs font-black text-white w-6 text-right">{stats[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Traits */}
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 border-t border-gray-800 pt-4 flex items-center gap-2">
                    <Crosshair size={12} className="text-purple-400" /> Special Traits
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {player.traits && player.traits.length > 0 ? (
                      player.traits.map(trait => (
                        <span key={trait} className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-purple-900/40 text-purple-300 border border-purple-500/50 rounded-md shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                          {trait}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-600 italic">No special traits</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="training"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col gap-4"
              >
                <div className="flex justify-between items-center bg-black/50 p-3 rounded border border-gray-800">
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

                {errorMsg && (
                  <div className="text-xs text-center font-bold text-neon-pink bg-red-900/20 p-2 rounded border border-neon-pink/30">
                    {errorMsg}
                  </div>
                )}

                {/* Medical Center */}
                {player.stamina < 100 && (
                  <div className="flex flex-col gap-2 mb-2 border-t border-gray-800 pt-3">
                    <h3 className="text-[10px] text-gray-500 uppercase tracking-widest flex justify-between">
                      <span>Medical Center</span>
                      <span className="text-orange-400">{tpBalance} TP available</span>
                    </h3>
                    <div className="flex justify-between items-center bg-black/50 p-2 rounded border border-gray-800">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mt-1">
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
                  <div className="text-center p-4 bg-green-900/20 border border-neon-green/30 rounded-lg mt-4">
                    <span className="text-sm font-bold text-neon-green uppercase tracking-wider">Maximum Potential Reached</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">
                    <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 pb-1 flex justify-between border-b border-gray-800 pt-2">
                      <span>Training Camp (Lvl {trainingLevel})</span>
                      <span>{trainCost} FC / pt</span>
                    </h3>
                    
                    {(Object.keys(statLabels) as Array<keyof PlayerStats>).map(key => {
                      const added = stagedStats[key] || 0;
                      const currentVal = stats[key] || 50;
                      const projectedVal = currentVal + added;

                      return (
                        <div key={key} className="flex items-center justify-between bg-black/40 p-2 rounded border border-gray-800 hover:border-neon-pink/30 transition-colors">
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
                                (!isMaxed && fancoins >= stagedCost + trainCost && player.stamina >= stagedStaminaCost + 5) ? 'bg-neon-pink/10 text-neon-pink border-neon-pink hover:bg-neon-pink hover:text-black' : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800">
                      <button
                        onClick={handleCancel}
                        disabled={totalPointsAdded === 0 || isSaving}
                        className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          totalPointsAdded > 0 ? 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700' : 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBulk}
                        disabled={totalPointsAdded === 0 || player.stamina < stagedStaminaCost || isSaving}
                        className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          totalPointsAdded > 0 && player.stamina >= stagedStaminaCost && !isSaving ? 'bg-neon-pink/20 text-neon-pink border-neon-pink hover:bg-neon-pink hover:text-black shadow-[0_0_15px_rgba(255,0,255,0.4)]' : 'bg-gray-900 text-gray-700 border-gray-800 cursor-not-allowed'
                        }`}
                      >
                        {isSaving ? 'Saving...' : `Save Stats`}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
