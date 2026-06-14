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
  pace: number; shooting: number; passing: number; defending: number; physical: number;
}

interface ProgressionEntry { ovr: number; recorded_at: string; }

interface Player {
  id: string; name: string; age: number; ovr: number; potential_limit: number;
  position: string; stamina: number; stats: PlayerStats; traits?: string[];
  perks?: string[]; is_injured?: boolean; injury_matches_left?: number;
  lineup_status: string; morale?: number; is_for_sale?: boolean;
  is_retired?: boolean; seasons_played?: number; progression_history?: ProgressionEntry[];
}

interface Props {
  player: Player; userId: string; onClose: () => void;
  onTrainSuccess: (updatedPlayer: Player, newBalance: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'general' | 'progression' | 'details';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'GENERAL', icon: <BarChart2 size={10} /> },
  { id: 'progression', label: 'PROGRESS', icon: <TrendingUp size={10} /> },
  { id: 'details', label: 'DETAILS', icon: <User size={10} /> },
];

const STAT_CONFIG: { key: keyof PlayerStats; label: string; color: string; bar: string }[] = [
  { key: 'pace', label: 'PAC', color: 'text-cyan-400', bar: 'bg-cyan-400' },
  { key: 'shooting', label: 'SHO', color: 'text-pink-400', bar: 'bg-pink-400' },
  { key: 'passing', label: 'PAS', color: 'text-yellow-400', bar: 'bg-yellow-400' },
  { key: 'defending', label: 'DEF', color: 'text-blue-400', bar: 'bg-blue-400' },
  { key: 'physical', label: 'PHY', color: 'text-emerald-400', bar: 'bg-emerald-400' },
];

const ROLE_WEIGHTS: Record<string, Partial<Record<keyof PlayerStats, number>>> = {
  GK: { physical: 0.35, defending: 0.35, pace: 0.15, passing: 0.15 },
  CB: { defending: 0.40, physical: 0.30, pace: 0.20, passing: 0.10 },
  LB: { defending: 0.30, pace: 0.30, physical: 0.20, passing: 0.20 },
  RB: { defending: 0.30, pace: 0.30, physical: 0.20, passing: 0.20 },
  CDM: { defending: 0.30, passing: 0.30, physical: 0.25, pace: 0.15 },
  CM: { passing: 0.35, physical: 0.20, defending: 0.20, pace: 0.15, shooting: 0.10 },
  CAM: { passing: 0.35, shooting: 0.30, pace: 0.20, physical: 0.15 },
  LW: { pace: 0.35, shooting: 0.25, passing: 0.25, physical: 0.15 },
  RW: { pace: 0.35, shooting: 0.25, passing: 0.25, physical: 0.15 },
  ST: { shooting: 0.40, pace: 0.25, physical: 0.20, passing: 0.15 },
  CF: { shooting: 0.35, passing: 0.25, pace: 0.25, physical: 0.15 },
};

function calcRoleOvr(stats: PlayerStats, position: string): number {
  const weights = ROLE_WEIGHTS[position] ?? {};
  const defaultW = 0.2;
  let sum = 0, totalW = 0;
  for (const cfg of STAT_CONFIG) {
    const w = (weights[cfg.key] ?? defaultW);
    sum += stats[cfg.key] * w;
    totalW += w;
  }
  return Math.round(sum / totalW);
}

// OVR Rarity System
function getRarity(ovr: number) {
  if (ovr >= 90) return {
    label: 'LEGEND', border: 'border-fuchsia-500/40', glow: 'shadow-[0_0_25px_rgba(217,70,239,0.2)]',
    text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10', textGlow: '0 0 15px rgba(217,70,239,0.5)',
    avatarBorder: 'border-fuchsia-500/40', avatarGlow: 'shadow-[0_0_20px_rgba(217,70,239,0.3)]',
    headerBg: 'from-fuchsia-500/8 to-transparent',
  };
  if (ovr >= 80) return {
    label: 'ELITE', border: 'border-amber-500/40', glow: 'shadow-[0_0_25px_rgba(245,158,11,0.2)]',
    text: 'text-amber-300', bg: 'bg-amber-500/10', textGlow: '0 0 15px rgba(245,158,11,0.5)',
    avatarBorder: 'border-amber-500/40', avatarGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    headerBg: 'from-amber-500/8 to-transparent',
  };
  if (ovr >= 65) return {
    label: 'PRO', border: 'border-cyan-500/30', glow: 'shadow-[0_0_20px_rgba(0,240,255,0.15)]',
    text: 'text-cyan-300', bg: 'bg-cyan-500/10', textGlow: '0 0 12px rgba(0,240,255,0.5)',
    avatarBorder: 'border-cyan-500/30', avatarGlow: 'shadow-[0_0_15px_rgba(0,240,255,0.2)]',
    headerBg: 'from-cyan-500/6 to-transparent',
  };
  return {
    label: 'ROOKIE', border: 'border-white/10', glow: '',
    text: 'text-gray-400', bg: 'bg-white/5', textGlow: 'none',
    avatarBorder: 'border-white/10', avatarGlow: '',
    headerBg: 'from-white/3 to-transparent',
  };
}

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
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [fancoins, setFancoins] = useState(0);
  const [sweatPoints, setSweatPoints] = useState(0);
  const [medicalLevel, setMedicalLevel] = useState(1);
  const [stadiumLevel, setStadiumLevel] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isHealing, setIsHealing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sellMode, setSellMode] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [isPendingSell, startTransition] = React.useTransition();
  const [renameMode, setRenameMode] = useState(false);
  const [newName, setNewName] = useState(player.name);
  const [isPendingRename, startTransitionRename] = React.useTransition();
  const [isPendingRetire, startTransitionRetire] = React.useTransition();
  const [isPendingQuickSell, startTransitionQuickSell] = React.useTransition();

  const { language } = React.useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const stats = player.stats ?? { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50 };
  const rarity = getRarity(player.ovr);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infraRes, userRes] = await Promise.all([
          fetch(`/api/infrastructure?userId=${userId}`),
          fetch(`/api/user/me?userId=${userId}`),
        ]);
        if (infraRes.ok) { const d = await infraRes.json(); setMedicalLevel(d.infrastructure?.medical_center_level ?? 1); setStadiumLevel(d.infrastructure?.stadium_level ?? 1); }
        if (userRes.ok) { const d = await userRes.json(); setFancoins(d.user?.balance_fancoins ?? 0); setSweatPoints(d.user?.sweat_points ?? 0); }
      } catch { /* silent */ } finally { setIsLoadingData(false); }
    };
    fetchData();
  }, [userId]);

  const healCost = Math.max(0, 100 - (player.stamina ?? 100));
  const canAffordHeal = sweatPoints >= healCost;
  const roleOvr = calcRoleOvr(stats, player.position);
  const chartData = (player.progression_history ?? []).map((e, i) => ({ i, ovr: e.ovr, label: e.recorded_at.slice(5, 10) }));
  const chartPoints = chartData.length >= 2 ? chartData : [{ i: 0, ovr: player.ovr, label: 'Now' }];

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
    } catch { setErrorMsg('Network error.'); } finally { setIsHealing(false); }
  };

  const handleSell = () => {
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) { toast.error('Enter valid TON price'); return; }
    const fee = stadiumLevel * 250;
    if (fancoins < fee) { toast.error(`Need ${fee} FC for tax`); return; }
    if (player.lineup_status === 'starting' || player.lineup_status === 'bench') { toast.error('Move to reserve first'); return; }
    startTransition(async () => {
      const res = await listPlayerAction(player.id, price);
      if (res.success) { toast.success(`Listed for ${price} TON`); window.dispatchEvent(new Event('balanceUpdated')); onClose(); }
      else toast.error(res.error || 'Error');
    });
  };

  const handleRename = () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 3) { toast.error('Min 3 characters'); return; }
    if (fancoins < 1000) { toast.error('Need 1000 FC'); return; }
    startTransitionRename(async () => {
      const res = await renamePlayerAction(player.id, trimmed);
      if (res.success) { toast.success(`Renamed to ${trimmed}!`); window.dispatchEvent(new Event('balanceUpdated')); setFancoins(p => p - 1000); player.name = trimmed; setRenameMode(false); }
      else toast.error(res.error || 'Error');
    });
  };

  const handleRetire = () => {
    startTransitionRetire(async () => {
      const res = await retirePlayerToAcademy(player.id);
      if (res.success) { toast.success('Coach sent to Academy!'); onClose(); }
      else toast.error(res.error || 'Error');
    });
  };

  const handleQuickSell = () => {
    if (!confirm(`Sell ${player.name} to system? This cannot be undone.`)) return;
    startTransitionQuickSell(async () => {
      const res = await quickSellPlayer(player.id);
      if (res.success) { toast.success(`Sold for ${res.payout} FC!`); onClose(); }
      else toast.error(res.error || 'Error');
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className={`w-full max-w-sm border backdrop-blur-2xl rounded-3xl overflow-hidden relative flex flex-col max-h-[88vh] ${rarity.border} ${rarity.glow}`}
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,30,0.98) 0%, rgba(8,8,20,1) 100%)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Glass highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* ── Hero Header — Compact with Rarity ──────────────────────────────── */}
        <div className={`relative flex-shrink-0 bg-gradient-to-br ${rarity.headerBg} via-transparent to-transparent px-4 pt-4 pb-3 border-b border-white/6`}>
          {/* Ambient glow based on rarity */}
          <div className={`absolute -top-8 left-1/2 -translate-x-1/2 w-40 h-20 blur-3xl pointer-events-none ${
            player.ovr >= 90 ? 'bg-fuchsia-500/10' : player.ovr >= 80 ? 'bg-amber-500/10' : player.ovr >= 65 ? 'bg-cyan-500/8' : 'bg-white/3'
          }`} />

          <div className="relative flex gap-3 items-start">
            {/* Avatar + OVR — Rarity styled */}
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 rounded-xl border flex items-center justify-center overflow-hidden ${rarity.avatarBorder} ${rarity.avatarGlow}`}
                   style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)' }}>
                <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${player.id}&backgroundColor=transparent`} alt="Avatar"
                     className="w-full h-full object-cover opacity-90 mix-blend-screen" />
              </div>
              {/* OVR badge */}
              <div className={`absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-lg border backdrop-blur-md flex flex-col items-center ${rarity.avatarBorder} ${rarity.bg}`}
                   style={{ boxShadow: rarity.textGlow !== 'none' ? `0 0 10px ${rarity.textGlow.replace('0 0 15px ', '').replace('0.5)', '0.3)')}` : 'none' }}>
                <span className={`text-[11px] font-black font-orbitron leading-none ${rarity.text}`}>{player.ovr}</span>
                <span className="text-[6px] text-gray-500 font-bold uppercase leading-none">{player.position}</span>
              </div>
            </div>

            {/* Info — Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h2 className="text-sm font-black font-orbitron text-white uppercase tracking-wide leading-tight truncate flex items-center gap-1"
                      style={{ textShadow: rarity.textGlow }}>
                    {player.name}
                    {!player.is_retired && !player.is_for_sale && (
                      <button onClick={() => setRenameMode(true)}
                              className="p-0.5 hover:bg-white/10 rounded transition-colors text-gray-600 hover:text-cyan-400 flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                    )}
                  </h2>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className={`text-[7px] font-black px-1 py-0.5 rounded border font-orbitron backdrop-blur-md ${
                      player.age >= 35 ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : player.age >= 31 ? 'bg-red-500/10 text-red-300 border-red-500/30'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>{player.age} YO</span>
                    <span className={`text-[7px] font-black px-1 py-0.5 rounded bg-black/40 border backdrop-blur-md ${rarity.border} ${rarity.text}`}>{rarity.label}</span>
                    {player.is_injured && (
                      <span className="text-[7px] bg-red-500/10 text-red-300 px-1 py-0.5 rounded border border-red-500/30 animate-pulse">
                        🚑 {player.injury_matches_left}M
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onClose}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 active:scale-90 flex-shrink-0">
                  <X size={12} />
                </button>
              </div>

              {/* Stamina + Morale — Compact bars */}
              <div className="flex flex-col gap-0.5 mt-1.5">
                <div className="flex items-center gap-1">
                  <Activity size={8} className={player.stamina > 50 ? 'text-emerald-400' : 'text-red-400'} />
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${player.stamina > 60 ? 'bg-emerald-400' : player.stamina > 30 ? 'bg-yellow-400' : 'bg-red-400'}`}
                         style={{ width: `${player.stamina}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-gray-500 w-6 text-right">{player.stamina}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] leading-none">😊</span>
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${(player.morale ?? 70) > 85 ? 'bg-emerald-400' : (player.morale ?? 70) < 40 ? 'bg-red-400' : 'bg-yellow-400'}`}
                         style={{ width: `${player.morale ?? 70}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-gray-500 w-6 text-right">{player.morale ?? 70}%</span>
                </div>
              </div>

              {/* Potential */}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[7px] text-gray-600 font-mono uppercase tracking-wider">POT</span>
                <span className="text-[7px] font-black font-orbitron text-pink-400">{player.potential_limit}</span>
              </div>
            </div>
          </div>

          {/* Tab bar — Glassmorphism */}
          {!sellMode && !renameMode && (
            <div className="flex gap-1 mt-3 bg-white/5 p-0.5 rounded-xl border border-white/10 backdrop-blur-md">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all duration-300 ${
                          activeTab === tab.id
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}>
                  {tab.icon}
                  {tab.id === 'general' ? (t?.prof_general || 'GENERAL') : tab.id === 'progression' ? (t?.prof_progress || 'PROGRESS') : (t?.prof_details || 'DETAILS')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
          {errorMsg && (
            <div className="mx-3 mt-2 text-[10px] text-center font-bold text-pink-400 bg-red-500/10 p-1.5 rounded-xl border border-red-500/30">{errorMsg}</div>
          )}

          {/* SELL MODE */}
          {sellMode ? (
            <div className="p-4 flex flex-col gap-3">
              <div className="text-center">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">{t?.prof_sell_market || 'List on Market'}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{t?.prof_nft_ton || 'NFT card for TON'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{t?.prof_price_ton || 'Price (TON)'}</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-lg">💎</span>
                  <input type="number" step="0.01" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                         placeholder="e.g. 1.5"
                         className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-orbitron text-base focus:border-cyan-500/50 outline-none transition-all" />
                </div>
              </div>
              <div className="bg-red-500/10 border border-red-500/25 p-2 rounded-xl text-[10px] text-red-400">
                <div className="flex justify-between font-bold mb-0.5"><span>{t?.prof_tax || 'Tax:'}</span><span>{stadiumLevel * 250} FC</span></div>
                <p className="text-[8px] text-red-400/60">Stadium Lv{stadiumLevel} × 250 FC — burned forever</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSellMode(false)} className="flex-1 py-2.5 rounded-xl font-bold text-[10px] uppercase text-gray-400 bg-white/5 hover:bg-white/8 transition-all border border-white/10">Cancel</button>
                <button onClick={handleSell} disabled={isPendingSell || !sellPrice}
                        className="flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase text-white bg-blue-600/80 hover:bg-blue-500 disabled:opacity-50 transition-all border border-blue-500/40"
                        style={{ boxShadow: '0 0 15px rgba(37,99,235,0.3)' }}>
                  {isPendingSell ? '...' : t?.prof_confirm || 'Confirm'}
                </button>
              </div>
            </div>

          /* RENAME MODE */
          ) : renameMode ? (
            <div className="p-4 flex flex-col gap-3">
              <div className="text-center">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">{t?.prof_rename || 'Change Name'}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{t?.prof_unique_name || 'Unique name in game'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{t?.prof_new_name || 'New Name'}</label>
                <input type="text" maxLength={25} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Cyber Striker"
                       className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-orbitron focus:border-pink-500/50 outline-none transition-all" />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/25 p-2 rounded-xl text-[10px]">
                <div className="flex justify-between font-bold text-amber-300 mb-0.5"><span>{t?.prof_cost || 'Cost:'}</span><span>1000 FC</span></div>
                <p className="text-[8px] text-amber-400/60">{t?.prof_licence || 'Real star names are protected by FIFPro.'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setRenameMode(false); setNewName(player.name); }} className="flex-1 py-2.5 rounded-xl font-bold text-[10px] uppercase text-gray-400 bg-white/5 hover:bg-white/8 transition-all border border-white/10">Cancel</button>
                <button onClick={handleRename} disabled={isPendingRename || !newName || newName === player.name}
                        className="flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all">
                  {isPendingRename ? '...' : t?.prof_confirm || 'Confirm'}
                </button>
              </div>
            </div>

          /* TAB CONTENT */
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>

                {/* ═══ GENERAL TAB ═══ */}
                {activeTab === 'general' && (
                  <div className="p-3 flex flex-col gap-2.5">
                    {/* OVR Role Grid — Glass */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
                      <p className="text-[7px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">{t?.prof_role_rating || 'Role Rating'}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <div className="text-xl font-black font-orbitron text-white" style={{ textShadow: rarity.textGlow }}>{player.ovr}</div>
                          <div className="text-[7px] text-gray-500 uppercase tracking-wider">OVR</div>
                        </div>
                        <div className="h-8 w-px bg-white/8" />
                        <div className="text-center">
                          <div className="text-xl font-black font-orbitron text-cyan-300" style={{ textShadow: '0 0 12px rgba(0,240,255,0.4)' }}>{roleOvr}</div>
                          <div className="text-[7px] text-gray-500 uppercase tracking-wider">{player.position} Role</div>
                        </div>
                        <div className="h-8 w-px bg-white/8" />
                        <div className="text-center">
                          <div className={`text-xl font-black font-orbitron ${rarity.text}`} style={{ textShadow: rarity.textGlow }}>{rarity.label}</div>
                          <div className="text-[7px] text-gray-500 uppercase tracking-wider">Grade</div>
                        </div>
                      </div>
                    </div>

                    {/* Radar Chart */}
                    <div className="h-[150px] w-full pointer-events-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="68%"
                          data={[
                            { subject: 'PAC', A: stats.pace, fullMark: 100 },
                            { subject: 'SHO', A: stats.shooting, fullMark: 100 },
                            { subject: 'PAS', A: stats.passing, fullMark: 100 },
                            { subject: 'PHY', A: stats.physical, fullMark: 100 },
                            { subject: 'DEF', A: stats.defending, fullMark: 100 },
                          ]}>
                          <PolarGrid stroke="#1e293b" opacity={0.6} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Stats" dataKey="A" stroke="#00f0ff" strokeWidth={2} fill="#00f0ff" fillOpacity={0.12} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Stat Bars — Glass */}
                    <div className="flex flex-col gap-1.5">
                      {STAT_CONFIG.map(cfg => (
                        <div key={cfg.key} className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold font-orbitron w-7 ${cfg.color}`}>{cfg.label}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                                 style={{ width: `${Math.min(100, Math.max(0, stats[cfg.key]))}%` }} />
                          </div>
                          <span className={`text-[10px] font-black font-orbitron w-5 text-right ${cfg.color}`}>{stats[cfg.key]}</span>
                        </div>
                      ))}
                    </div>

                    {/* Heal Section — Glass */}
                    {(player.stamina < 100 || player.is_injured) && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-2.5 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Medical (Lv {medicalLevel})</span>
                          <span className="text-[8px] text-emerald-400 font-mono">{sweatPoints} SP</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-0.5">
                              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${player.stamina}%` }} />
                              </div>
                              <span className="text-[8px] font-mono text-orange-400">{player.stamina}%</span>
                            </div>
                            {medicalLevel > 1 && <span className="text-[7px] text-emerald-500 font-mono">-{Math.min(medicalLevel * 5, 50)}% discount</span>}
                          </div>
                          <button id={`heal-btn-${player.id}`} onClick={handleHeal} disabled={!canAffordHeal || isHealing || isLoadingData}
                                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all duration-300 border backdrop-blur-md ${
                                    isHealing ? 'bg-white/5 text-emerald-400 border-emerald-500/30 opacity-50'
                                      : canAffordHeal ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95'
                                      : 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                                  }`}
                                  style={canAffordHeal && !isHealing ? { boxShadow: '0 0 12px rgba(52,211,153,0.15)' } : {}}>
                            <span>{isHealing ? '...' : 'HEAL'}</span>
                            <span className="text-[6px] opacity-70 block">{healCost === 0 ? 'Free' : `${healCost} SP`}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ PROGRESSION TAB ═══ */}
                {activeTab === 'progression' && (
                  <div className="p-3 flex flex-col gap-2.5">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[7px] text-gray-500 uppercase tracking-widest font-bold">{t?.prof_ovr_history || 'OVR History'}</p>
                        <span className="text-[8px] text-cyan-400 font-mono font-bold">{chartData.length} snapshots</span>
                      </div>
                      {chartData.length < 2 ? (
                        <div className="h-24 flex flex-col items-center justify-center gap-1.5">
                          <TrendingUp size={24} className="text-gray-700" />
                          <p className="text-[9px] text-gray-600 text-center">Progress appears after first training</p>
                          <p className="text-[8px] text-gray-700 font-mono">Current OVR: {player.ovr}</p>
                        </div>
                      ) : (
                        <div className="h-[140px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPoints} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
                              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 7 }} tickLine={false} axisLine={false} />
                              <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 8 }} tickLine={false} axisLine={false} />
                              <Tooltip content={<OvrTooltip />} />
                              <Line type="monotone" dataKey="ovr" stroke="#00f0ff" strokeWidth={2} dot={false}
                                    activeDot={{ r: 3, fill: '#00f0ff', strokeWidth: 0 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {chartData.length >= 2 && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Start', val: chartData[0].ovr, color: 'text-gray-400' },
                          { label: 'Peak', val: Math.max(...chartData.map(d => d.ovr)), color: 'text-amber-300' },
                          { label: 'Growth', val: `+${chartData[chartData.length - 1].ovr - chartData[0].ovr}`, color: 'text-emerald-400' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-1.5 text-center backdrop-blur-md">
                            <div className={`text-sm font-black font-orbitron ${color}`}>{val}</div>
                            <div className="text-[6px] text-gray-600 uppercase tracking-wider mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[7px] text-gray-500 uppercase tracking-widest font-bold">{t?.prof_pot_headroom || 'Potential'}</span>
                        <span className="text-[8px] font-mono text-pink-400">{Math.max(0, player.potential_limit - player.ovr)} left</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-700"
                             style={{ width: `${Math.min(100, (player.ovr / (player.potential_limit || 99)) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[7px] text-gray-700 font-mono">{player.ovr}</span>
                        <span className="text-[7px] text-gray-700 font-mono">{player.potential_limit}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ DETAILS TAB ═══ */}
                {activeTab === 'details' && (
                  <div className="p-3 flex flex-col gap-2.5">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 grid grid-cols-2 gap-2 backdrop-blur-md">
                      {[
                        { label: 'Position', val: player.position },
                        { label: 'Age', val: `${player.age} years` },
                        { label: 'Seasons', val: player.seasons_played ?? 0 },
                        { label: 'Status', val: player.lineup_status || '—' },
                        { label: 'OVR', val: player.ovr },
                        { label: 'Potential', val: player.potential_limit },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <div className="text-[6px] text-gray-500 uppercase tracking-widest font-bold">{label}</div>
                          <div className="text-[10px] font-black font-orbitron text-white mt-0.5 capitalize">{val}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Crosshair size={9} className="text-violet-400" />
                        <span className="text-[7px] text-gray-500 uppercase tracking-widest font-bold">{t?.prof_traits || 'Traits'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {player.traits && player.traits.length > 0 ? (
                          player.traits.map(trait => (
                            <span key={trait} className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/25 rounded-lg backdrop-blur-md">
                              {trait}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-gray-600 italic">{t?.prof_no_traits || 'No traits'}</span>
                        )}
                      </div>
                    </div>

                    {player.perks && player.perks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Zap size={9} className="text-amber-400" />
                          <span className="text-[7px] text-gray-500 uppercase tracking-widest font-bold">{t?.prof_perks || 'Perks'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {player.perks.map(perk => (
                            <span key={perk} className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-lg backdrop-blur-md">
                              {perk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
                      <p className="text-[7px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">{t?.prof_age_curve || 'Age Curve'}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { range: '≤ 30', label: t?.prof_peak || 'Peak', color: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/8' },
                          { range: '31-34', label: t?.prof_decay || 'Decay', color: 'text-amber-300 border-amber-500/25 bg-amber-500/8' },
                          { range: '≥ 35', label: t?.prof_veteran || 'Veteran', color: 'text-violet-300 border-violet-500/25 bg-violet-500/8' },
                        ].map(({ range, label, color }) => (
                          <span key={range} className={`px-1.5 py-0.5 text-[7px] font-bold rounded-lg border backdrop-blur-md ${color} ${
                            player.age <= 30 && label === 'Peak' ? 'ring-1 ring-emerald-400/40'
                              : player.age >= 35 && label === 'Veteran' ? 'ring-1 ring-violet-400/40'
                              : player.age >= 31 && label === 'Decay' ? 'ring-1 ring-amber-400/40' : ''
                          }`}>{range}: {label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* ── Floating Action Bar — Glassmorphism ──────────────────────────── */}
        {!sellMode && !renameMode && (
          <div className="flex-shrink-0 absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/95 to-transparent">
            {player.is_for_sale ? (
              <div className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest backdrop-blur-md">
                Listed on Market
              </div>
            ) : player.is_retired ? (
              <div className="flex gap-1.5">
                <button onClick={() => setSellMode(true)} className="flex-1 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-black text-[9px] uppercase tracking-wider hover:bg-blue-500/20 transition-all duration-300 active:scale-95 backdrop-blur-md">Sell (TON)</button>
                <button onClick={handleRetire} disabled={isPendingRetire} className="flex-1 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 font-black text-[9px] uppercase tracking-wider hover:bg-violet-500/20 disabled:opacity-50 transition-all duration-300 active:scale-95 backdrop-blur-md">{isPendingRetire ? '...' : t?.prof_to_coach || 'To Coach'}</button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setSellMode(true)} className="flex-1 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-black text-[9px] uppercase tracking-wider hover:bg-blue-500/20 transition-all duration-300 active:scale-95 backdrop-blur-md">TON</button>
                <button onClick={handleQuickSell} disabled={isPendingQuickSell || player.lineup_status === 'starting'}
                        className="flex-1 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black text-[9px] uppercase tracking-wider hover:bg-amber-500/20 disabled:opacity-40 transition-all duration-300 active:scale-95 backdrop-blur-md"
                        title={player.lineup_status === 'starting' ? 'Move to reserve first' : ''}>
                  {isPendingQuickSell ? '...' : `${Math.max(100, (player.ovr - 40) * 100)} FC`}
                </button>
                <Link href={`/base?playerId=${player.id}`} onClick={onClose}
                      className="flex-1 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-black text-[9px] uppercase tracking-wider hover:bg-cyan-500/20 flex items-center justify-center transition-all duration-300 active:scale-95 backdrop-blur-md">
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
