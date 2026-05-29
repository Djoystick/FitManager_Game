'use client';

import { useState, useTransition, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Footprints, Zap, ArrowRightLeft, FlaskConical, Flame, Dumbbell, CircleDot } from 'lucide-react';
import {
  syncStepsAction,
  convertSweatPointsAction,
  type ManagerProfileType,
  type CurrencyType,
  type SyncStepsResult,
  type ConvertSpResult,
} from '@/app/actions/economyActions';
import { dict } from '@/lib/dictionaries';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_STEP_CAP = 25_000;

// Profile labels moved inside component to support translations

// Multiplier matrix (mirrors DB logic — used only for local preview)
const MULTIPLIER_MATRIX: Record<ManagerProfileType, Record<CurrencyType, number>> = {
  runner:      { cardio: 1.0, fitness: 0.6, ball: 0.4, strength: 0.2 },
  yogi:        { cardio: 0.6, fitness: 1.0, ball: 0.4, strength: 0.2 },
  ball_player: { cardio: 0.2, fitness: 0.6, ball: 1.0, strength: 0.4 },
  lifter:      { cardio: 0.2, fitness: 0.4, ball: 0.6, strength: 1.0 },
};

const CURRENCY_META: Record<CurrencyType, { label: string; icon: React.ReactNode; accent: string; glow: string }> = {
  cardio:   { label: 'Cardio Coin',    icon: <Flame size={16} />,      accent: 'text-orange-400',  glow: 'shadow-[0_0_10px_rgba(251,146,60,0.4)]'   },
  fitness:  { label: 'Fitness Coin',   icon: <FlaskConical size={16} />, accent: 'text-purple-400', glow: 'shadow-[0_0_10px_rgba(192,132,252,0.4)]' },
  ball:     { label: 'Ball Coin',      icon: <CircleDot size={16} />,   accent: 'text-yellow-400',  glow: 'shadow-[0_0_10px_rgba(250,204,21,0.4)]'   },
  strength: { label: 'Strength Coin',  icon: <Dumbbell size={16} />,    accent: 'text-red-400',     glow: 'shadow-[0_0_10px_rgba(248,113,113,0.4)]'  },
};

function multiplierBadge(mult: number): string {
  if (mult >= 0.9) return 'text-neon-green bg-neon-green/10 border-neon-green/30';
  if (mult >= 0.5) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  return 'text-gray-500 bg-gray-800/40 border-gray-700/40';
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SweatBankClientProps {
  initialData: {
    manager_profile: ManagerProfileType;
    daily_steps: number;
    sweat_points: number;
    cardio_coin: number;
    fitness_coin: number;
    ball_coin: number;
    strength_coin: number;
  };
  language: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SweatBankClient({ initialData, language }: SweatBankClientProps) {
  const t = dict[language as keyof typeof dict];

  // Local mirrors of server state — updated optimistically on action success
  const [dailySteps, setDailySteps] = useState(initialData.daily_steps);
  const [sweatPoints, setSweatPoints] = useState(initialData.sweat_points);
  const [coinBalances, setCoinBalances] = useState({
    cardio:   initialData.cardio_coin,
    fitness:  initialData.fitness_coin,
    ball:     initialData.ball_coin,
    strength: initialData.strength_coin,
  });
  const profile = initialData.manager_profile;

  const PROFILE_LABELS: Record<ManagerProfileType, { label: string; emoji: string; color: string }> = {
    runner:      { label: t.profile_runner, emoji: '🏃', color: 'text-neon-green' },
    yogi:        { label: t.profile_yogi,   emoji: '🧘', color: 'text-purple-400' },
    ball_player: { label: t.profile_ball,   emoji: '⚽', color: 'text-yellow-400' },
    lifter:      { label: t.profile_lifter, emoji: '🏋️', color: 'text-red-400' },
  };

  // Exchange inputs: one integer input per currency
  const [spInputs, setSpInputs] = useState<Record<CurrencyType, string>>({
    cardio: '', fitness: '', ball: '', strength: '',
  });

  const [isSyncing, startSyncTransition] = useTransition();
  const [isConverting, startConvertTransition] = useTransition();

  // ── Step Sync ──────────────────────────────────────────────────────────────

  const handleSyncSteps = useCallback((amount: number) => {
    startSyncTransition(async () => {
      const res = await syncStepsAction(amount);
      if (res.success && res.data) {
        const d = res.data as SyncStepsResult;
        setDailySteps(d.daily_steps);
        setSweatPoints(d.total_sp);
        toast.success(t.toast_sync_success.replace('{sp}', d.sp_gained.toString()).replace('{steps}', d.added_steps.toString()));
      } else {
        toast.error(res.error ?? t.toast_sync_error);
      }
    });
  }, []);

  // ── Conversion ─────────────────────────────────────────────────────────────

  const handleConvert = useCallback((currency: CurrencyType) => {
    const raw = spInputs[currency];
    const amount = parseInt(raw, 10);
    if (!raw || isNaN(amount) || amount <= 0) {
      toast.error(t.toast_invalid_sp);
      return;
    }
    if (amount > sweatPoints) {
      toast.error(t.toast_insufficient_sp);
      return;
    }

    startConvertTransition(async () => {
      const res = await convertSweatPointsAction(currency, amount);
      if (res.success && res.data) {
        const d = res.data as ConvertSpResult;
        setSweatPoints(d.new_balance_sp);
        setCoinBalances(prev => ({ ...prev, [currency]: d.new_balance_currency }));
        setSpInputs(prev => ({ ...prev, [currency]: '' }));
        toast.success(t.toast_convert_success.replace('{coins}', d.gained_coins.toString()).replace('{coinName}', CURRENCY_META[currency].label));
      } else {
        toast.error(res.error ?? t.toast_convert_error);
      }
    });
  }, [spInputs, sweatPoints]);

  const profileMeta = PROFILE_LABELS[profile];
  const stepPct = Math.min((dailySteps / DAILY_STEP_CAP) * 100, 100);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 pb-6">

      {/* ── BLOCK 1: Pedometer ─────────────────────────────────────────────── */}
      <section className="bg-black/40 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Footprints className="text-neon-green w-5 h-5" />
          <h2 className="text-sm font-black uppercase tracking-widest text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">
            {t.pedometer}
          </h2>
        </div>

        {/* Step progress bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-end">
            <span className="text-2xl font-black text-white tabular-nums font-orbitron">
              {dailySteps.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 font-bold">/ {DAILY_STEP_CAP.toLocaleString()} {t.steps_lower}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-green to-cyan-400 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(57,255,20,0.5)]"
              style={{ width: `${stepPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 font-bold">
            <span>0</span>
            <span className="text-gray-500">{stepPct.toFixed(1)}%</span>
            <span>25K</span>
          </div>
        </div>

        {/* SP Balance */}
        <div className="flex items-center justify-between bg-neon-green/5 border border-neon-green/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Zap className="text-neon-green w-4 h-4" />
            <span className="text-xs uppercase tracking-widest font-bold text-gray-400">Sweat Points</span>
          </div>
          <span className="text-xl font-black text-neon-green font-orbitron drop-shadow-[0_0_8px_rgba(57,255,20,0.6)]">
            {sweatPoints.toLocaleString()}
          </span>
        </div>

        {/* DEBUG UI */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold flex items-center gap-1">
            <FlaskConical size={10} />
            {t.debug_mode}
          </p>
          <div className="flex gap-2">
            {[1000, 5500].map(amt => (
              <button
                key={amt}
                onClick={() => handleSyncSteps(amt)}
                disabled={isSyncing}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                  isSyncing
                    ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                    : 'bg-neon-green/10 text-neon-green border-neon-green/40 hover:bg-neon-green/20 active:scale-95'
                }`}
              >
                {isSyncing ? '...' : `+${amt.toLocaleString()} ${t.steps_lower}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── BLOCK 2: Manager Profile ────────────────────────────────────────── */}
      <section className="bg-black/40 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
            {t.manager_profile_title}
          </h2>
          <span className={`text-sm font-black ${profileMeta.color} flex items-center gap-1.5`}>
            {profileMeta.emoji} {profileMeta.label}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
          {t.bonus_multiplier}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(CURRENCY_META) as [CurrencyType, typeof CURRENCY_META[CurrencyType]][]).map(([curr, meta]) => {
            const mult = MULTIPLIER_MATRIX[profile][curr];
            return (
              <div key={curr} className={`flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900/50 border ${mult >= 0.9 ? 'border-neon-green/30' : 'border-gray-800'}`}>
                <span className={`flex items-center gap-1.5 text-xs font-bold ${meta.accent}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${multiplierBadge(mult)}`}>
                  x{mult.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── BLOCK 3: Exchange ───────────────────────────────────────────────── */}
      <section className="bg-black/40 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-neon-pink w-5 h-5" />
          <h2 className="text-sm font-black uppercase tracking-widest text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,100,0.5)]">
            {t.sp_exchange}
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {(Object.entries(CURRENCY_META) as [CurrencyType, typeof CURRENCY_META[CurrencyType]][]).map(([curr, meta]) => {
            const mult = MULTIPLIER_MATRIX[profile][curr];
            const rawInput = spInputs[curr];
            const spAmt = parseInt(rawInput, 10);
            const preview = rawInput && !isNaN(spAmt) && spAmt > 0
              ? Math.floor(spAmt * mult)
              : null;

            return (
              <div key={curr} className={`border rounded-xl p-3 flex flex-col gap-2 ${curr === Object.keys(CURRENCY_META)[0] ? '' : ''} bg-gray-900/40 border-gray-800`}>
                {/* Header row: icon + name + balance */}
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${meta.accent}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-xs font-black text-white font-orbitron">
                    {coinBalances[curr].toLocaleString()}
                  </span>
                </div>

                {/* Input + preview + button */}
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min={1}
                      max={sweatPoints}
                      value={rawInput}
                      onChange={e => setSpInputs(prev => ({ ...prev, [curr]: e.target.value }))}
                      placeholder="SP"
                      className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-all"
                    />
                    {preview !== null && (
                      <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${meta.accent}`}>
                        →{preview}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleConvert(curr)}
                    disabled={isConverting || !rawInput}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                      isConverting || !rawInput
                        ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                        : `${meta.accent} bg-gray-900 border-gray-700 hover:border-current active:scale-95 ${meta.glow}`
                    }`}
                  >
                    {isConverting ? '...' : t.exchange_btn}
                  </button>
                </div>

                {/* Multiplier indicator inline */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">{t.exchange_rate}</span>
                  <span className={`text-[9px] font-black ${multiplierBadge(mult).split(' ')[0]}`}>
                    100 SP → {Math.floor(100 * mult)} {t.coins_lower} (x{mult.toFixed(1)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
