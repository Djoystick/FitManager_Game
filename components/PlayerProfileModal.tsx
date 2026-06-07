'use client';

import React, { useState, useEffect } from 'react';
import { X, Activity, TrendingUp, User, Crosshair, Zap, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { healPlayer } from '@/app/actions/baseActions';
import { renamePlayerAction, retirePlayerToAcademy, quickSellPlayer } from '@/app/actions/teamActions';
import { listPlayerAction } from '@/app/actions/marketActions';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

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

interface ProgressionEntry {
  ovr:         number;
  recorded_at: string;
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
  perks?:               string[];
  is_injured?:          boolean;
  injury_matches_left?: number;
  lineup_status:        string;
  is_for_sale?:         boolean;
  is_retired?:          boolean;
  seasons_played?:      number;
  progression_history?: ProgressionEntry[];
}

interface Props {
  player:         Player;
  userId:         string;
  onClose:        () => void;
  onTrainSuccess: (updatedPlayer: Player, newBalance: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'general' | 'progression' | 'details';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general',     label: 'GENERAL',     icon: <BarChart2 size={11} /> },
  { id: 'progression', label: 'PROGRESS',    icon: <TrendingUp size={11} /> },
  { id: 'details',     label: 'DETAILS',     icon: <User size={11} /> },
];

const STAT_CONFIG: { key: keyof PlayerStats; label: string; color: string; bar: string }[] = [
  { key: 'pace',      label: 'PAC', color: 'text-cyan-400',    bar: 'bg-cyan-400' },
  { key: 'shooting',  label: 'SHO', color: 'text-pink-400',    bar: 'bg-pink-400' },
  { key: 'passing',   label: 'PAS', color: 'text-yellow-400',  bar: 'bg-yellow-400' },
  { key: 'defending', label: 'DEF', color: 'text-blue-400',    bar: 'bg-blue-400' },
  { key: 'physical',  label: 'PHY', color: 'text-emerald-400', bar: 'bg-emerald-400' },
];

/** Role weights: position → which stats to emphasize */
const ROLE_WEIGHTS: Record<string, Partial<Record<keyof PlayerStats, number>>> = {
  GK:  { physical: 0.35, defending: 0.35, pace: 0.15, passing: 0.15 },
  CB:  { defending: 0.40, physical: 0.30, pace: 0.20, passing: 0.10 },
  LB:  { defending: 0.30, pace: 0.30, physical: 0.20, passing: 0.20 },
  RB:  { defending: 0.30, pace: 0.30, physical: 0.20, passing: 0.20 },
  CDM: { defending: 0.30, passing: 0.30, physical: 0.25, pace: 0.15 },
  CM:  { passing: 0.35,   physical: 0.20, defending: 0.20, pace: 0.15, shooting: 0.10 },
  CAM: { passing: 0.35,   shooting: 0.30, pace: 0.20, physical: 0.15 },
  LW:  { pace: 0.35,      shooting: 0.25, passing: 0.25, physical: 0.15 },
  RW:  { pace: 0.35,      shooting: 0.25, passing: 0.25, physical: 0.15 },
  ST:  { shooting: 0.40,  pace: 0.25, physical: 0.20, passing: 0.15 },
  CF:  { shooting: 0.35,  passing: 0.25, pace: 0.25, physical: 0.15 },
};

function calcRoleOvr(stats: PlayerStats, position: string): number {
  const weights = ROLE_WEIGHTS[position] ?? {};
  const defaultW = 0.2;
  let sum = 0, totalW = 0;
  for (const cfg of STAT_CONFIG) {
    const w = (weights[cfg.key] ?? defaultW);
    sum    += stats[cfg.key] * w;
    totalW += w;
  }
  return Math.round(sum / totalW);
}

function ovrGrade(ovr: number): { label: string; color: string } {
  if (ovr >= 90) return { label: 'LEGEND', color: 'text-yellow-400' };
  if (ovr >= 80) return { label: 'ELITE',  color: 'text-violet-400' };
  if (ovr >= 70) return { label: 'PRO',    color: 'text-cyan-400'   };
  if (ovr >= 60) return { label: 'SOLID',  color: 'text-emerald-400'};
  return             { label: 'ROOKIE', color: 'text-gray-400'    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip for Line Chart
// ─────────────────────────────────────────────────────────────────────────────

function OvrTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-cyan-500/30 rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-400">
      OVR {payload[0].value}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerProfileModal({ player, userId, onClose, onTrainSuccess }: Props) {
  const [activeTab,      setActiveTab]      = useState<TabId>('general');
  const [fancoins,       setFancoins]       = useState(0);
  const [sweatPoints,    setSweatPoints]    = useState(0);
  const [medicalLevel,   setMedicalLevel]   = useState(1);
  const [stadiumLevel,   setStadiumLevel]   = useState(1);
  const [isLoadingData,  setIsLoadingData]  = useState(true);
  const [isHealing,      setIsHealing]      = useState(false);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);

  const [sellMode,         setSellMode]         = useState(false);
  const [sellPrice,        setSellPrice]        = useState('');
  const [isPendingSell,    startTransition]     = React.useTransition();

  const [renameMode,           setRenameMode]           = useState(false);
  const [newName,              setNewName]              = useState(player.name);
  const [isPendingRename,      startTransitionRename]   = React.useTransition();
  const [isPendingRetire,      startTransitionRetire]   = React.useTransition();
  const [isPendingQuickSell,   startTransitionQuickSell] = React.useTransition();

  const { language } = React.useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const stats = player.stats ?? { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };

  // ── Data Fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infraRes, userRes] = await Promise.all([
          fetch(`/api/infrastructure?userId=${userId}`),
          fetch(`/api/user/me?userId=${userId}`),
        ]);
        if (infraRes.ok) {
          const d = await infraRes.json();
          setMedicalLevel(d.infrastructure?.medical_center_level ?? 1);
          setStadiumLevel(d.infrastructure?.stadium_level ?? 1);
        }
        if (userRes.ok) {
          const d = await userRes.json();
          setFancoins(d.user?.balance_fancoins ?? 0);
          setSweatPoints(d.user?.sweat_points ?? 0);
        }
      } catch { /* silent */ }
      finally { setIsLoadingData(false); }
    };
    fetchData();
  }, [userId]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const healCost      = Math.max(0, 100 - (player.stamina ?? 100));
  const canAffordHeal = sweatPoints >= healCost;
  const roleOvr       = calcRoleOvr(stats, player.position);
  const grade         = ovrGrade(player.ovr);

  // Progression chart data
  const chartData = (player.progression_history ?? []).map((e, i) => ({
    i,
    ovr:   e.ovr,
    label: e.recorded_at.slice(5, 10), // "MM-DD"
  }));

  // Fill flat line if no history yet
  const chartPoints = chartData.length >= 2
    ? chartData
    : [{ i: 0, ovr: player.ovr, label: 'Now' }];

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleHeal = async () => {
    if (!canAffordHeal || isHealing) return;
    setIsHealing(true); setErrorMsg(null);
    try {
      const res = await healPlayer(player.id);
      if (res.success) {
        const newBal = res.new_balance ?? sweatPoints - healCost;
        setSweatPoints(newBal);
        window.dispatchEvent(new Event('balanceUpdated'));
        onTrainSuccess({ ...player, stamina: 100, is_injured: false, injury_matches_left: 0 } as Player, newBal);
      } else { setErrorMsg(res.error ?? 'Healing failed'); }
    } catch { setErrorMsg('Network error.'); }
    finally { setIsHealing(false); }
  };

  const handleSell = () => {
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) { toast.error('Введите корректную цену в TON'); return; }
    const fee = stadiumLevel * 250;
    if (fancoins < fee) { toast.error(`Нужно ${fee} FC для налога`); return; }
    if (player.lineup_status === 'starting' || player.lineup_status === 'bench') {
      toast.error('Сначала переведите игрока в резерв'); return;
    }
    startTransition(async () => {
      const res = await listPlayerAction(player.id, price);
      if (res.success) { toast.success(`Выставлен за ${price} TON`); window.dispatchEvent(new Event('balanceUpdated')); onClose(); }
      else toast.error(res.error || 'Ошибка');
    });
  };

  const handleRename = () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 3) { toast.error('Минимум 3 символа'); return; }
    if (fancoins < 1000) { toast.error('Нужно 1000 FC'); return; }
    startTransitionRename(async () => {
      const res = await renamePlayerAction(player.id, trimmed);
      if (res.success) {
        toast.success(`Переименован в ${trimmed}!`);
        window.dispatchEvent(new Event('balanceUpdated'));
        setFancoins(p => p - 1000);
        player.name = trimmed;
        setRenameMode(false);
      } else toast.error(res.error || 'Ошибка');
    });
  };

  const handleRetire = () => {
    startTransitionRetire(async () => {
      const res = await retirePlayerToAcademy(player.id);
      if (res.success) { toast.success('Тренер применён к Академии!'); onClose(); }
      else toast.error(res.error || 'Ошибка');
    });
  };

  const handleQuickSell = () => {
    if (!confirm(`Продать ${player.name} системе? Это нельзя отменить.`)) return;
    startTransitionQuickSell(async () => {
      const res = await quickSellPlayer(player.id);
      if (res.success) { toast.success(`Продан за ${res.payout} FC!`); onClose(); }
      else toast.error(res.error || 'Ошибка');
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full max-w-sm bg-[#0a0e1a] border border-white/8 shadow-[0_0_40px_rgba(0,240,255,0.1)] rounded-t-3xl sm:rounded-3xl overflow-hidden relative flex flex-col max-h-[92vh]"
      >
        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <div className="relative flex-shrink-0 bg-gradient-to-br from-[#0d1428] via-[#0a0e1a] to-[#0d1020] px-5 pt-5 pb-4 border-b border-white/6">
          {/* Ambient glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="relative flex gap-4 items-start">
            {/* Avatar + OVR */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-900/40 to-violet-900/40 border border-cyan-500/20 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                <img
                  src={`https://api.dicebear.com/9.x/micah/svg?seed=${player.id}&backgroundColor=transparent`}
                  alt="Avatar"
                  className="w-full h-full object-cover opacity-90 mix-blend-screen"
                />
              </div>
              {/* OVR badge */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-black border border-cyan-500/40 flex flex-col items-center justify-center shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                <span className="text-[10px] font-black font-orbitron text-white leading-none">{player.ovr}</span>
                <span className="text-[6px] text-cyan-400 font-bold uppercase leading-none">{player.position}</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-black font-orbitron text-white uppercase tracking-wide leading-tight truncate flex items-center gap-1.5">
                    {player.name}
                    {!player.is_retired && !player.is_for_sale && (
                      <button
                        onClick={() => setRenameMode(true)}
                        className="p-0.5 hover:bg-gray-800 rounded transition-colors text-gray-600 hover:text-cyan-400 flex-shrink-0"
                        title="Rename (1000 FC)"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                    )}
                  </h2>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {/* Age badge */}
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border font-orbitron ${
                      player.age >= 35 ? 'bg-purple-900/50 text-purple-400 border-purple-500/40'
                        : player.age >= 31 ? 'bg-red-900/40 text-red-400 border-red-500/40'
                        : 'bg-gray-800/60 text-gray-400 border-gray-700/40'
                    }`}>{player.age} YO</span>

                    {/* Decay warning */}
                    {player.age >= 31 && !player.is_retired && (
                      <span className="text-[7px] text-red-500 uppercase tracking-widest bg-red-900/20 px-1 py-0.5 rounded border border-red-800/40">{t?.prof_decay || 'Decay'}</span>
                    )}

                    {/* Grade */}
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md bg-black/40 border border-white/6 ${grade.color}`}>{grade.label}</span>

                    {/* Injured */}
                    {player.is_injured && (
                      <span className="text-[8px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded border border-red-500/40 animate-pulse">
                        🚑 {player.injury_matches_left}M
                      </span>
                    )}
                  </div>

                  {/* Stamina */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Activity size={10} className={player.stamina > 50 ? 'text-emerald-400' : 'text-red-400'} />
                    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${player.stamina > 60 ? 'bg-emerald-400' : player.stamina > 30 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${player.stamina}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">{player.stamina}%</span>
                  </div>

                  {/* Potential */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[8px] text-gray-600 font-mono uppercase tracking-wider">POT</span>
                    <span className="text-[8px] font-black font-orbitron text-pink-400">{player.potential_limit}</span>
                    <span className="text-[8px] text-gray-700 font-mono">/ 99</span>
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-600 hover:text-white bg-black/40 rounded-xl border border-white/6 hover:border-gray-600 transition-all flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          {!sellMode && !renameMode && (
            <div className="flex gap-1 mt-4 bg-black/40 p-1 rounded-xl border border-white/5">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {tab.icon}
                  {tab.id === 'general' ? (t?.prof_general || 'GENERAL') : tab.id === 'progression' ? (t?.prof_progress || 'PROGRESS') : (t?.prof_details || 'DETAILS')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
          {/* Error banner */}
          {errorMsg && (
            <div className="mx-4 mt-3 text-xs text-center font-bold text-pink-400 bg-red-900/20 p-2 rounded-xl border border-pink-500/30">
              {errorMsg}
            </div>
          )}

          {/* ── SELL MODE ──────────────────────────────────────────────────── */}
          {sellMode ? (
            <div className="p-5 flex flex-col gap-4">
              <div className="text-center">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">{t?.prof_sell_market || 'List on Market'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t?.prof_nft_ton || 'NFT card for TON'}</p>
              </div>
              <div className="bg-black/50 p-4 rounded-2xl border border-white/8">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{t?.prof_price_ton || 'Price (TON)'}</label>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xl">💎</span>
                  <input
                    type="number" step="0.01" min="0" value={sellPrice}
                    onChange={e => setSellPrice(e.target.value)}
                    placeholder="Например: 1.5"
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white font-orbitron text-lg focus:border-cyan-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="bg-red-900/15 border border-red-500/25 p-3 rounded-2xl text-xs text-red-400">
                <div className="flex justify-between font-bold mb-1"><span>{t?.prof_tax || 'Tax:'}</span><span>{stadiumLevel * 250} FC</span></div>
                <p className="text-[9px] text-red-500/70">Уровень стадиона {stadiumLevel} × 250 FC — сжигается навсегда</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSellMode(false)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase text-gray-400 bg-gray-800/60 hover:bg-gray-700/60 transition-all border border-white/6">
                  Отмена
                </button>
                <button onClick={handleSell} disabled={isPendingSell || !sellPrice}
                  className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-white bg-blue-600/80 hover:bg-blue-500 disabled:opacity-50 transition-all shadow-[0_0_16px_rgba(37,99,235,0.3)] border border-blue-500/40">
                  {isPendingSell ? '...' : t?.prof_confirm || 'Confirm'}
                </button>
              </div>
            </div>

          /* ── RENAME MODE ───────────────────────────────────────────────── */
          ) : renameMode ? (
            <div className="p-5 flex flex-col gap-4">
              <div className="text-center">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">{t?.prof_rename || 'Change Name'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t?.prof_unique_name || 'Unique name in game'}</p>
              </div>
              <div className="bg-black/50 p-4 rounded-2xl border border-white/8">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{t?.prof_new_name || 'New Name'}</label>
                <input
                  type="text" maxLength={25} value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Cyber Striker"
                  className="w-full mt-2 bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white font-orbitron focus:border-pink-500/50 outline-none transition-all"
                />
              </div>
              <div className="bg-yellow-900/15 border border-yellow-500/25 p-3 rounded-2xl text-xs">
                <div className="flex justify-between font-bold text-yellow-400 mb-1"><span>{t?.prof_cost || 'Cost:'}</span><span>1000 FC</span></div>
                <p className="text-[9px] text-yellow-600">{t?.prof_licence || 'Real star names are protected by FIFPro.'}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRenameMode(false); setNewName(player.name); }}
                  className="flex-1 py-3 rounded-xl font-bold text-xs uppercase text-gray-400 bg-gray-800/60 hover:bg-gray-700/60 transition-all border border-white/6">
                  Отмена
                </button>
                <button onClick={handleRename} disabled={isPendingRename || !newName || newName === player.name}
                  className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 transition-all shadow-[0_0_16px_rgba(234,179,8,0.3)]">
                  {isPendingRename ? '...' : t?.prof_confirm || 'Confirm'}
                </button>
              </div>
            </div>

          /* ── TAB CONTENT ───────────────────────────────────────────────── */
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                {/* ════════════════ GENERAL TAB ════════════════ */}
                {activeTab === 'general' && (
                  <div className="p-4 flex flex-col gap-4">

                    {/* OVR Role Grid */}
                    <div className="bg-black/40 border border-white/6 rounded-2xl p-3">
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-2">{t?.prof_role_rating || 'Role Rating'}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <div className="text-2xl font-black font-orbitron text-white">{player.ovr}</div>
                          <div className="text-[8px] text-gray-600 uppercase tracking-wider">OVR</div>
                        </div>
                        <div className="h-10 w-px bg-white/8" />
                        <div className="text-center">
                          <div className="text-2xl font-black font-orbitron text-cyan-400">{roleOvr}</div>
                          <div className="text-[8px] text-gray-600 uppercase tracking-wider">{player.position} Role</div>
                        </div>
                        <div className="h-10 w-px bg-white/8" />
                        <div className="text-center">
                          <div className={`text-2xl font-black font-orbitron ${grade.color}`}>{grade.label}</div>
                          <div className="text-[8px] text-gray-600 uppercase tracking-wider">Grade</div>
                        </div>
                      </div>
                    </div>

                    {/* Radar Chart */}
                    <div className="h-[180px] w-full pointer-events-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="68%"
                          data={[
                            { subject: 'PAC', A: stats.pace,      fullMark: 100 },
                            { subject: 'SHO', A: stats.shooting,  fullMark: 100 },
                            { subject: 'PAS', A: stats.passing,   fullMark: 100 },
                            { subject: 'PHY', A: stats.physical,  fullMark: 100 },
                            { subject: 'DEF', A: stats.defending, fullMark: 100 },
                          ]}
                        >
                          <PolarGrid stroke="#1e293b" opacity={0.8} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Stats" dataKey="A" stroke="#00f0ff" strokeWidth={2} fill="#00f0ff" fillOpacity={0.15} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Stat Bars */}
                    <div className="flex flex-col gap-2">
                      {STAT_CONFIG.map(cfg => (
                        <div key={cfg.key} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold font-orbitron w-8 ${cfg.color}`}>{cfg.label}</span>
                          <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-white/5">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, stats[cfg.key]))}%` }}
                            />
                          </div>
                          <span className={`text-xs font-black font-orbitron w-6 text-right ${cfg.color}`}>{stats[cfg.key]}</span>
                        </div>
                      ))}
                    </div>

                    {/* Heal Section */}
                    {(player.stamina < 100 || player.is_injured) && (
                      <div className="bg-black/40 border border-emerald-800/30 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Медпункт (Lv {medicalLevel})</span>
                          <span className="text-[9px] text-emerald-400 font-mono">{sweatPoints} SP</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${player.stamina}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-orange-400">{player.stamina}%</span>
                            </div>
                            {medicalLevel > 1 && (
                              <span className="text-[8px] text-emerald-500 font-mono">−{Math.min(medicalLevel * 5, 50)}% скидка</span>
                            )}
                          </div>
                          <button
                            id={`heal-btn-${player.id}`}
                            onClick={handleHeal}
                            disabled={!canAffordHeal || isHealing || isLoadingData}
                            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                              isHealing ? 'bg-transparent text-emerald-400 border-emerald-400/40 opacity-50'
                                : canAffordHeal ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/40 hover:bg-emerald-400 hover:text-black active:scale-95 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                                : 'bg-gray-800/50 text-gray-600 border-gray-700/30 cursor-not-allowed'
                            }`}
                          >
                            <span>{isHealing ? '...' : 'HEAL'}</span>
                            <span className="text-[7px] opacity-75">{healCost === 0 ? 'Free' : `${healCost} SP`}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ════════════════ PROGRESSION TAB ════════════════ */}
                {activeTab === 'progression' && (
                  <div className="p-4 flex flex-col gap-4">
                    <div className="bg-black/40 border border-white/6 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t?.prof_ovr_history || 'OVR History'}</p>
                        <span className="text-[9px] text-cyan-400 font-mono font-bold">
                          {chartData.length} snapshots
                        </span>
                      </div>

                      {chartData.length < 2 ? (
                        <div className="h-32 flex flex-col items-center justify-center gap-2">
                          <TrendingUp size={28} className="text-gray-700" />
                          <p className="text-[10px] text-gray-600 text-center">
                            Прогресс появится после первой тренировки
                          </p>
                          <p className="text-[9px] text-gray-700 font-mono">Current OVR: {player.ovr}</p>
                        </div>
                      ) : (
                        <div className="h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 8 }} tickLine={false} axisLine={false} />
                              <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                              <Tooltip content={<OvrTooltip />} />
                              <Line
                                type="monotone" dataKey="ovr"
                                stroke="#00f0ff" strokeWidth={2} dot={false}
                                activeDot={{ r: 3, fill: '#00f0ff', strokeWidth: 0 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Stats over time summary */}
                    {chartData.length >= 2 && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Start OVR', val: chartData[0].ovr,    color: 'text-gray-400' },
                          { label: 'Peak OVR',  val: Math.max(...chartData.map(d => d.ovr)), color: 'text-yellow-400' },
                          { label: 'Growth',    val: `+${chartData[chartData.length - 1].ovr - chartData[0].ovr}`, color: 'text-emerald-400' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="bg-black/40 border border-white/6 rounded-xl p-2 text-center">
                            <div className={`text-base font-black font-orbitron ${color}`}>{val}</div>
                            <div className="text-[7px] text-gray-600 uppercase tracking-wider mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Potential gauge */}
                    <div className="bg-black/40 border border-white/6 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t?.prof_pot_headroom || 'Potential Headroom'}</span>
                        <span className="text-[9px] font-mono text-pink-400">
                          {Math.max(0, player.potential_limit - player.ovr)} OVR left
                        </span>
                      </div>
                      <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-700"
                          style={{ width: `${Math.min(100, (player.ovr / (player.potential_limit || 99)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-gray-700 font-mono">{player.ovr}</span>
                        <span className="text-[8px] text-gray-700 font-mono">{player.potential_limit}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ════════════════ DETAILS TAB ════════════════ */}
                {activeTab === 'details' && (
                  <div className="p-4 flex flex-col gap-4">

                    {/* Player card info */}
                    <div className="bg-black/40 border border-white/6 rounded-2xl p-3 grid grid-cols-2 gap-3">
                      {[
                        { label: 'Position',  val: player.position },
                        { label: 'Age',       val: `${player.age} years` },
                        { label: 'Seasons',   val: player.seasons_played ?? 0 },
                        { label: 'Status',    val: player.lineup_status || '—' },
                        { label: 'OVR',       val: player.ovr },
                        { label: 'Potential', val: player.potential_limit },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <div className="text-[7px] text-gray-600 uppercase tracking-widest font-bold">{label}</div>
                          <div className="text-xs font-black font-orbitron text-white mt-0.5 capitalize">{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Traits */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Crosshair size={10} className="text-violet-400" />
                        <span className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t?.prof_traits || 'Special Traits'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {player.traits && player.traits.length > 0 ? (
                          player.traits.map(trait => (
                            <span key={trait}
                              className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-violet-900/30 text-violet-300 border border-violet-500/40 rounded-lg shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                              {trait}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-600 italic">{t?.prof_no_traits || 'No special traits'}</span>
                        )}
                      </div>
                    </div>

                    {/* Perks */}
                    {player.perks && player.perks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap size={10} className="text-yellow-400" />
                          <span className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t?.prof_perks || 'Perks'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {player.perks.map(perk => (
                            <span key={perk}
                              className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-yellow-900/30 text-yellow-400 border border-yellow-700/40 rounded-lg">
                              {perk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Age curve info */}
                    <div className="bg-black/40 border border-white/6 rounded-2xl p-3">
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-2">{t?.prof_age_curve || 'Age Curve'}</p>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { range: '≤ 30', label: t?.prof_peak || 'Peak', color: 'text-emerald-400 border-emerald-700/40 bg-emerald-900/20' },
                          { range: '31-34', label: t?.prof_decay || 'Decay', color: 'text-orange-400 border-orange-700/40 bg-orange-900/20' },
                          { range: '≥ 35', label: t?.prof_veteran || 'Veteran', color: 'text-violet-400 border-violet-700/40 bg-violet-900/20' },
                        ].map(({ range, label, color }) => (
                          <span key={range}
                            className={`px-2 py-1 text-[8px] font-bold rounded-lg border ${color} ${player.age <= 30 && label === 'Peak' ? 'ring-1 ring-emerald-400/40' : player.age >= 35 && label === 'Veteran' ? 'ring-1 ring-violet-400/40' : player.age >= 31 && label === 'Decay' ? 'ring-1 ring-orange-400/40' : ''}`}>
                            {range}: {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* ── Floating Action Bar ──────────────────────────────────────────── */}
        {!sellMode && !renameMode && (
          <div className="flex-shrink-0 absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/95 to-transparent">
            {player.is_for_sale ? (
              <div className="w-full py-3 bg-gray-900/80 border border-gray-700/40 rounded-2xl text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                Выставлен на рынок
              </div>
            ) : player.is_retired ? (
              <div className="flex gap-2">
                <button onClick={() => setSellMode(true)}
                  className="flex-1 py-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-black text-xs uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all">
                  Продать (TON)
                </button>
                <button onClick={handleRetire} disabled={isPendingRetire}
                  className="flex-1 py-3 rounded-2xl bg-violet-600/20 border border-violet-500/40 text-violet-400 font-black text-xs uppercase tracking-wider hover:bg-violet-600 hover:text-white disabled:opacity-50 transition-all">
                  {isPendingRetire ? '...' : t?.prof_to_coach || 'To Coach'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setSellMode(true)}
                  className="flex-1 py-2.5 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 font-black text-[9px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all">
                  TON
                </button>
                <button onClick={handleQuickSell}
                  disabled={isPendingQuickSell || player.lineup_status === 'starting'}
                  className="flex-1 py-2.5 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-400 font-black text-[9px] uppercase tracking-wider hover:bg-orange-600 hover:text-white disabled:opacity-40 transition-all"
                  title={player.lineup_status === 'starting' ? 'Переведите в запас' : ''}>
                  {isPendingQuickSell ? '...' : `${Math.max(100, (player.ovr - 40) * 100)} FC`}
                </button>
                <Link
                  href={`/base?playerId=${player.id}`}
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-black text-[9px] uppercase tracking-wider hover:bg-cyan-500 hover:text-black flex items-center justify-center transition-all shadow-[0_0_12px_rgba(0,240,255,0.1)]"
                >
                  Train
                </Link>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
