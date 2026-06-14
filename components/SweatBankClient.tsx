'use client';

import { usePageTour } from '@/components/providers/PageTourProvider';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Footprints, Zap, ArrowRightLeft, Flame, Dumbbell, CircleDot } from 'lucide-react';
import {
  convertSweatPointsAction,
  type ManagerProfileType,
  type CurrencyType,
  type ConvertSpResult,
} from '@/app/actions/economyActions';
import { dict } from '@/lib/dictionaries';
import { FitnessSyncWidget } from '@/components/FitnessSyncWidget';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────


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
  fitness:  { label: 'Fitness Coin',   icon: <Zap size={16} />,           accent: 'text-purple-400', glow: 'shadow-[0_0_10px_rgba(192,132,252,0.4)]' },
  ball:     { label: 'Ball Coin',      icon: <CircleDot size={16} />,   accent: 'text-yellow-400',  glow: 'shadow-[0_0_10px_rgba(250,204,21,0.4)]'   },
  strength: { label: 'Strength Coin',  icon: <Dumbbell size={16} />,    accent: 'text-red-400',     glow: 'shadow-[0_0_10px_rgba(248,113,113,0.4)]'  },
};

function multiplierBadge(mult: number): string {
  if (mult >= 0.9) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  if (mult >= 0.5) return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-gray-500 bg-white/5 border-white/10';
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
    last_step_sync: string;
  };
  language: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SweatBankClient({ initialData, language }: SweatBankClientProps) {
  const router = useRouter();
  const { startTour, hasSeenTour, areAllToursSkipped } = usePageTour();
  const t = dict[language as keyof typeof dict];


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

  const [isConverting, startConvertTransition] = useTransition();

  // ── Conversion ─────────────────────────────────────────────────────────────

  const triggerTour = () => {
    if (areAllToursSkipped()) return;
    startTour('bank', [
      {
        targetId: 'fitness-sync-btn',
        title: 'Синхронизация шагов',
        description: 'Сначала нажми "Синхронизировать", чтобы получить Sweat Points (SP) за свои реальные шаги.',
      },
      {
        targetId: 'bank-exchange-section',
        title: '💱 Обмен SP',
        description: 'Здесь ты можешь обменять накопленные SP на разные виды игровых монет. Разные профили имеют разные бонусы обмена!',
      }
    ]);
  };

  useEffect(() => {
    const handleStartTour = () => triggerTour();
    window.addEventListener('startPageTour', handleStartTour);
    
    // Auto-start if never seen
    if (!hasSeenTour('bank')) {
      const timer = setTimeout(triggerTour, 500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('startPageTour', handleStartTour);
      };
    }
    
    return () => window.removeEventListener('startPageTour', handleStartTour);
  }, [hasSeenTour, areAllToursSkipped, startTour]);

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-4 pb-6 relative text-white z-10">

      {/* ── BLOCK 1: Step Sync ─────────────────────────────────────────────── */}
      <FitnessSyncWidget />

      {/* ── BLOCK 2: Manager Profile — Glassmorphism ────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-4 flex flex-col gap-3 backdrop-blur-xl"
               style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-cyan-300"
              style={{ textShadow: '0 0 10px rgba(0,240,255,0.4)' }}>
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
              <div key={curr} className={`flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border ${mult >= 0.9 ? 'border-emerald-500/30' : 'border-white/10'} backdrop-blur-md`}>
                <span className={`flex items-center gap-1.5 text-xs font-bold ${meta.accent}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border backdrop-blur-sm ${multiplierBadge(mult)}`}>
                  x{mult.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── BLOCK 3: Exchange — Glassmorphism ──────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 p-4 flex flex-col gap-3 backdrop-blur-xl" id="bank-exchange-section"
               style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400/20 to-transparent" />
        
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-pink-400 w-5 h-5" />
          <h2 className="text-sm font-black uppercase tracking-widest text-pink-300"
              style={{ textShadow: '0 0 10px rgba(236,72,153,0.4)' }}>
            {t.sp_exchange}
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {(Object.entries(CURRENCY_META) as [CurrencyType, typeof CURRENCY_META[CurrencyType]][]).map(([curr, meta]) => {
            const mult = MULTIPLIER_MATRIX[profile][curr];
            const rawInput = spInputs[curr];
            const spAmt = parseInt(rawInput, 10);
            const preview = rawInput && !isNaN(spAmt) && spAmt > 0 ? Math.floor(spAmt * mult) : null;

            return (
              <div key={curr} className="border border-white/10 rounded-2xl p-3 flex flex-col gap-2 bg-white/[0.03] backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${meta.accent}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-xs font-black text-white font-orbitron">
                    {coinBalances[curr].toLocaleString()}
                  </span>
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 relative">
                    <input type="number" min={1} max={sweatPoints} value={rawInput}
                           onChange={e => setSpInputs(prev => ({ ...prev, [curr]: e.target.value }))}
                           placeholder="SP"
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/50 transition-all duration-300" />
                    {preview !== null && (
                      <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${meta.accent}`}>→{preview}</span>
                    )}
                  </div>
                  <button onClick={() => handleConvert(curr)} disabled={isConverting || !rawInput}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all duration-300 whitespace-nowrap backdrop-blur-md ${
                            isConverting || !rawInput
                              ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                              : `${meta.accent} bg-white/5 border-white/10 hover:bg-white/10 active:scale-95`
                          }`}>
                    {isConverting ? '...' : t.exchange_btn}
                  </button>
                </div>
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

