'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, Zap, User, Crosshair, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { bulkTrainPlayer } from '@/app/actions/playerActions';
import { healPlayer } from '@/app/actions/baseActions';
import { InfoPopover } from '@/components/ui/InfoPopover';
import Link from 'next/link';
import { listPlayerAction } from '@/app/actions/marketActions';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerStats {
  pace:      number;
  shooting:  number;
  passing:   number;
  defending: number;
  physical:  number;
}

interface Player {
  id:                   string;
  name:                 string;
  age:                  number;
  ovr:                  number;
  potential_limit:      number;
  position:             string;
  stamina:              number;
  stats:                PlayerStats;
  traits?:              string[];
  is_injured?:          boolean;
  injury_matches_left?: number;
  lineup_status:        string;
  is_for_sale?:         boolean;
  is_retired?:          boolean;
  seasons_played?:      number;
}

interface Props {
  player:          Player;
  userId:          string;
  onClose:         () => void;
  onTrainSuccess:  (updatedPlayer: Player, newBalance: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Exponential building cost mirror (for display only) */
function buildingUpgradeCost(level: number) {
  return Math.floor(500 * Math.pow(level, 1.5));
}


// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerProfileModal({ player, userId, onClose, onTrainSuccess }: Props) {
  const [fancoins,      setFancoins]      = useState<number>(0);
  const [sweatPoints,   setSweatPoints]   = useState<number>(0);
  const [medicalLevel,  setMedicalLevel]  = useState<number>(1);
  const [stadiumLevel,  setStadiumLevel]  = useState<number>(1);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isHealing,     setIsHealing]     = useState(false);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);

  const [sellMode,      setSellMode]      = useState(false);
  const [sellPrice,     setSellPrice]     = useState('');
  const [isPendingSell, startTransition]  = React.useTransition();

  // ── Load balances + medical level ─────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infraRes, userRes] = await Promise.all([
          fetch(`/api/infrastructure?userId=${userId}`),
          fetch(`/api/user/me?userId=${userId}`),
        ]);

        if (infraRes.ok) {
          const infraData = await infraRes.json();
          setMedicalLevel(infraData.infrastructure?.medical_center_level ?? 1);
          setStadiumLevel(infraData.infrastructure?.stadium_level ?? 1);
        }
        if (userRes.ok) {
          const userData = await userRes.json();
          setFancoins(userData.user?.balance_fancoins ?? 0);
          setSweatPoints(userData.user?.sweat_points ?? 0);
        }
      } catch (err) {
        console.error('[PlayerProfileModal] Failed to fetch data:', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [userId]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const stats = player.stats || { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };

  const cost = Math.max(0, 100 - (player.stamina ?? 100));
  const canAffordHeal = sweatPoints >= cost;

  // ── Heal handler ─────────────────────────────────────────────────────────

  const handleHeal = async () => {
    if (!canAffordHeal || isHealing) return;
    setIsHealing(true);
    setErrorMsg(null);

    try {
      const res = await healPlayer(userId, player.id);
      if (res.success) {
        const newBal = res.new_balance ?? sweatPoints - cost;
        setSweatPoints(newBal);
        window.dispatchEvent(new Event('balanceUpdated'));
        const updatedPlayer = { ...player, stamina: 100, is_injured: false, injury_matches_left: 0 };
        onTrainSuccess(updatedPlayer as Player, newBal);
      } else {
        setErrorMsg(res.error ?? 'Healing failed');
      }
    } catch {
      setErrorMsg('Network error occurred.');
    } finally {
      setIsHealing(false);
    }
  };

  // ── Sell handler ─────────────────────────────────────────────────────────
  const handleSell = () => {
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Введите корректную цену в TON');
      return;
    }
    const fee = stadiumLevel * 250;
    if (fancoins < fee) {
      toast.error(`Недостаточно FanCoins для налога. Нужно: ${fee} FC`);
      return;
    }
    if (player.lineup_status === 'starting' || player.lineup_status === 'bench') {
      toast.error('Игрок в составе. Сначала переведите его в резерв.');
      return;
    }

    startTransition(async () => {
      const res = await listPlayerAction(player.id, price);
      if (res.success) {
        toast.success(`Игрок выставлен на рынок за ${price} TON`);
        window.dispatchEvent(new Event('balanceUpdated'));
        onClose(); // Close modal on success
      } else {
        toast.error(res.error || 'Ошибка при выставлении на рынок');
      }
    });
  };

  // ── Stat display config ───────────────────────────────────────────────────

  const statLabels: Record<keyof PlayerStats, string> = {
    pace:      'PAC',
    shooting:  'SHO',
    passing:   'PAS',
    defending: 'DEF',
    physical:  'PHY',
  };

  const statColors: Record<keyof PlayerStats, string> = {
    pace:      'bg-neon-cyan',
    shooting:  'bg-neon-pink',
    passing:   'bg-yellow-400',
    defending: 'bg-blue-500',
    physical:  'bg-green-500',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-gray-950 border border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,255,0.15)] rounded-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-start bg-gradient-to-b from-neon-cyan/10 to-transparent flex-shrink-0">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-xl bg-black/60 border border-neon-cyan/40 shadow-[inset_0_0_15px_rgba(0,255,255,0.2)] flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{player.ovr}</span>
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

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-5 flex flex-col gap-5">

          {sellMode ? (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <h3 className="text-sm font-black text-white uppercase tracking-widest text-center">Выставить на рынок</h3>
              <p className="text-xs text-gray-400 text-center -mt-2">Продажа NFT-карточки за TON</p>
              
              <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Цена (TON)</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xl">💎</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="Например: 1.5"
                    className="flex-1 w-0 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white font-orbitron text-xl focus:border-neon-cyan outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between text-xs text-red-400 font-bold uppercase tracking-widest">
                  <span>Налог на размещение (Fee):</span>
                  <span>{stadiumLevel * 250} FC</span>
                </div>
                <p className="text-[10px] text-red-500/70">
                  Этот налог высчитывается из уровня вашего Стадиона ({stadiumLevel} ур.) и будет сожжен навсегда.
                </p>
              </div>

              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setSellMode(false)}
                  disabled={isPendingSell}
                  className="flex-1 py-3 rounded-lg font-bold uppercase tracking-widest text-xs bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleSell}
                  disabled={isPendingSell || !sellPrice}
                  className="flex-1 py-3 rounded-lg font-black uppercase tracking-widest text-xs bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                >
                  {isPendingSell ? 'Загрузка...' : 'Подтвердить'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Error banner */}
          {errorMsg && (
            <div className="text-xs text-center font-bold text-neon-pink bg-red-900/20 p-2 rounded border border-neon-pink/30">
              {errorMsg}
            </div>
          )}

          {/* ── Stats ────────────────────────────────────────────────────── */}
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
                    <div
                      className={`h-full ${statColors[key]} transition-all duration-1000`}
                      style={{ width: `${Math.min(100, Math.max(0, stats[key]))}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-white w-6 text-right">{stats[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Traits ───────────────────────────────────────────────────── */}
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

          {/* ── Heal Section (FC, Medical Center discount) ───────────────── */}
          {(player.stamina < 100 || player.is_injured) && (
            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 flex items-center justify-between">
                <span>Медпункт (Lv {medicalLevel})</span>
                <span className="text-yellow-400 font-mono">
                  {isLoadingData ? '...' : `${fancoins.toLocaleString()} FC`}
                </span>
              </h3>

              <div className="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-gray-800">
                <div className="flex flex-col gap-1">
                  {/* Stamina bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${player.stamina}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-orange-400">{player.stamina}/100</span>
                  </div>
                  {/* Discount note */}
                  {medicalLevel > 1 && (
                    <span className="text-[9px] text-emerald-500 font-mono">
                      −{Math.min(medicalLevel * 5, 50)}% скидка Медпункта
                    </span>
                  )}
                </div>

                <button
                  id={`heal-btn-${player.id}`}
                  onClick={handleHeal}
                  disabled={!canAffordHeal || isHealing || isLoadingData}
                  className={`
                    px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider
                    transition-all duration-200 border flex flex-col items-center
                    ${isHealing
                      ? 'bg-transparent text-neon-green border-neon-green/50 opacity-50'
                      : canAffordHeal
                      ? 'bg-neon-green/10 text-neon-green border-neon-green hover:bg-neon-green hover:text-black shadow-[0_0_10px_rgba(57,255,20,0.3)] active:scale-95'
                      : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    }
                  `}
                >
                  <span>{isHealing ? '...' : 'Heal'}</span>
                  <span className="text-[8px] font-mono opacity-75">{isLoadingData ? '...' : cost === 0 ? 'Free' : `${cost} SP`}</span>
                </button>
              </div>
            </div>
          )}

            </div>
          )}

          {/* ── Footer Actions ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-800 pt-4 flex flex-col gap-3">
            {player.is_for_sale ? (
              <div className="w-full py-3 bg-gray-900 border border-gray-700 rounded-xl text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                Игрок выставлен на рынок
              </div>
            ) : player.is_retired ? (
              <div className="w-full py-3 bg-purple-900/20 border border-purple-500/50 rounded-xl text-center text-xs font-bold text-purple-400 uppercase tracking-widest">
                Игрок на пенсии (Зал Славы)
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setSellMode(true)}
                  className="flex-1 py-3 rounded-xl bg-blue-900/30 border border-blue-500/50 text-blue-400 font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                >
                  Продать (TON)
                </button>
                <Link
                  href={`/base?playerId=${player.id}`}
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-black text-xs uppercase tracking-widest hover:bg-neon-cyan hover:text-black flex items-center justify-center transition-all shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                >
                  Тренировать
                </Link>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}
