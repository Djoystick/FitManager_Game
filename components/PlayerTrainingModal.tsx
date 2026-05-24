'use client';

import { useState, useEffect } from 'react';

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
  const [isTraining, setIsTraining] = useState<string | null>(null);
  const [isHealing, setIsHealing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  const isMaxed = player.ovr >= player.potential_limit;

  const handleTrain = async (statKey: keyof PlayerStats) => {
    if (fancoins < trainCost) {
      setErrorMsg('Insufficient FanCoins');
      return;
    }
    
    setIsTraining(statKey);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/players/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playerId: player.id, statKey })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setFancoins(data.newBalance);
        onTrainSuccess(data.player, data.newBalance);
      } else {
        setErrorMsg(data.error || 'Training failed');
      }
    } catch (err) {
      setErrorMsg('Network error occurred.');
    } finally {
      setIsTraining(null);
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
      const res = await fetch('/api/players/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playerId: player.id })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setTpBalance(prev => prev - 50);
        window.dispatchEvent(new Event('balanceUpdated')); // Trigger global header update
        
        // Optimistically update player in parent component
        const updatedPlayer = { ...player, stamina: 100 };
        // We pass fancoins since it didn't change
        onTrainSuccess(updatedPlayer, fancoins);
      } else {
        setErrorMsg(data.error || 'Healing failed');
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
              <span className="text-xl font-black text-white">{player.ovr}</span>
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
            <span className="text-sm font-black text-neon-cyan">{isLoadingData ? '...' : fancoins.toLocaleString()} FC</span>
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
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 border-b border-gray-800 pb-1">Training Camp (Lvl {trainingLevel})</h3>
              
              {(Object.keys(statLabels) as Array<keyof PlayerStats>).map(key => (
                <div key={key} className="flex items-center justify-between bg-black/40 p-2 rounded border border-gray-800 hover:border-neon-cyan/50 transition-colors">
                  <div className="flex items-center gap-3 w-1/2">
                    <span className="text-xs font-orbitron text-gray-400 w-8">{statLabels[key]}</span>
                    <span className="text-sm font-black text-neon-green">{player.stats[key]}</span>
                  </div>
                  <button 
                    onClick={() => handleTrain(key)}
                    disabled={fancoins < trainCost || isTraining !== null}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      isTraining === key
                        ? 'bg-neon-cyan text-black border-neon-cyan'
                        : fancoins >= trainCost
                          ? 'bg-transparent text-neon-cyan border-neon-cyan hover:bg-neon-cyan hover:text-black'
                          : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {isTraining === key ? '...' : `Train (${trainCost} FC)`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
