'use client';

import React, {
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  Trophy,
  Hospital,
  GraduationCap,
  Search,
  Dumbbell,
  Users,
  ChevronRight,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import {
  getClubInfrastructureData,
  getTrainingCampData,
  upgradeBuildingAction,
  trainPlayerStatAction,
  type ClubInfrastructure,
  type TrainingCampData,
  type PlayerForTraining,
  type StatKey,
  type SpecCurrencyType,
  type BuildingType,
} from '@/app/actions/trainingActions';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Static definitions — declared outside component so Tailwind class scanner
// can see all literal class names and include them in the build output.
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'infrastructure' | 'training';

// ── Stat definitions ──────────────────────────────────────────────────────────

interface StatDef {
  key: StatKey;
  label: string;
  fullLabel: string;
  currency: SpecCurrencyType;
  currencyLabel: string;
  currencyEmoji: string;
  colorText: string;
  colorBg: string;
  colorBorder: string;
  colorBar: string;
}

const STAT_DEFS: StatDef[] = [
  {
    key: 'pac', label: 'PAC', fullLabel: 'Скорость',
    currency: 'cardio_coin', currencyLabel: 'Cardio', currencyEmoji: '🏃',
    colorText: 'text-cyan-400', colorBg: 'bg-cyan-900/20',
    colorBorder: 'border-cyan-800/40', colorBar: 'bg-cyan-400',
  },
  {
    key: 'sta', label: 'STA', fullLabel: 'Стамина',
    currency: 'cardio_coin', currencyLabel: 'Cardio', currencyEmoji: '🏃',
    colorText: 'text-cyan-300', colorBg: 'bg-cyan-900/20',
    colorBorder: 'border-cyan-800/40', colorBar: 'bg-cyan-300',
  },
  {
    key: 'agi', label: 'AGI', fullLabel: 'Ловкость',
    currency: 'fitness_coin', currencyLabel: 'Fitness', currencyEmoji: '🤸',
    colorText: 'text-emerald-400', colorBg: 'bg-emerald-900/20',
    colorBorder: 'border-emerald-800/40', colorBar: 'bg-emerald-400',
  },
  {
    key: 'def', label: 'DEF', fullLabel: 'Защита',
    currency: 'fitness_coin', currencyLabel: 'Fitness', currencyEmoji: '🤸',
    colorText: 'text-emerald-300', colorBg: 'bg-emerald-900/20',
    colorBorder: 'border-emerald-800/40', colorBar: 'bg-emerald-300',
  },
  {
    key: 'dri', label: 'DRI', fullLabel: 'Дриблинг',
    currency: 'ball_coin', currencyLabel: 'Ball', currencyEmoji: '⚽',
    colorText: 'text-orange-400', colorBg: 'bg-orange-900/20',
    colorBorder: 'border-orange-800/40', colorBar: 'bg-orange-400',
  },
  {
    key: 'pas', label: 'PAS', fullLabel: 'Пасы',
    currency: 'ball_coin', currencyLabel: 'Ball', currencyEmoji: '⚽',
    colorText: 'text-orange-300', colorBg: 'bg-orange-900/20',
    colorBorder: 'border-orange-800/40', colorBar: 'bg-orange-300',
  },
  {
    key: 'phy', label: 'PHY', fullLabel: 'Физика',
    currency: 'strength_coin', currencyLabel: 'Strength', currencyEmoji: '💪',
    colorText: 'text-rose-400', colorBg: 'bg-rose-900/20',
    colorBorder: 'border-rose-800/40', colorBar: 'bg-rose-400',
  },
  {
    key: 'sho', label: 'SHO', fullLabel: 'Удары',
    currency: 'strength_coin', currencyLabel: 'Strength', currencyEmoji: '💪',
    colorText: 'text-rose-300', colorBg: 'bg-rose-900/20',
    colorBorder: 'border-rose-800/40', colorBar: 'bg-rose-300',
  },
];

// ── Building definitions ───────────────────────────────────────────────────────

interface BuildingDef {
  key: BuildingType;
  label: string;
  description: string;
  bonusLabel: string;
  Icon: React.ElementType;
  colorText: string;
  colorBg: string;
  colorBorder: string;
  colorHoverBorder: string;
  colorGlow: string;
}

const BUILDING_DEFS: BuildingDef[] = [
  {
    key: 'stadium', label: 'Стадион',
    description: 'Пассивный доход FanCoins за каждый матч',
    bonusLabel: '+50 FC / матч / уровень',
    Icon: Trophy,
    colorText:        'text-yellow-400',
    colorBg:          'bg-yellow-900/20',
    colorBorder:      'border-yellow-800/40',
    colorHoverBorder: 'hover:border-yellow-500/60',
    colorGlow:        'bg-yellow-500/8',
  },
  {
    key: 'medical', label: 'Медпункт',
    description: 'Скидка на лечение травмированных игроков',
    bonusLabel: '-5% стоимость / уровень',
    Icon: Hospital,
    colorText:        'text-pink-400',
    colorBg:          'bg-pink-900/20',
    colorBorder:      'border-pink-800/40',
    colorHoverBorder: 'hover:border-pink-500/60',
    colorGlow:        'bg-pink-500/8',
  },
  {
    key: 'academy', label: 'Академия',
    description: 'Улучшает стартовые характеристики новичков',
    bonusLabel: '+2 OVR генетики / уровень',
    Icon: GraduationCap,
    colorText:        'text-violet-400',
    colorBg:          'bg-violet-900/20',
    colorBorder:      'border-violet-800/40',
    colorHoverBorder: 'hover:border-violet-500/60',
    colorGlow:        'bg-violet-500/8',
  },
  {
    key: 'scout', label: 'Скауты',
    description: 'Шанс выпадения перков при генерации игрока',
    bonusLabel: '+5% шанс перка / уровень',
    Icon: Search,
    colorText:        'text-teal-400',
    colorBg:          'bg-teal-900/20',
    colorBorder:      'border-teal-800/40',
    colorHoverBorder: 'hover:border-teal-500/60',
    colorGlow:        'bg-teal-500/8',
  },
];

// ── Old stat key compatibility mapping ────────────────────────────────────────

const LEGACY_KEY: Partial<Record<StatKey, string>> = {
  pac: 'pace',
  sho: 'shooting',
  pas: 'passing',
  def: 'defending',
  phy: 'physical',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatValue(
  stats: Record<string, unknown> | null | undefined,
  key: StatKey
): number {
  if (!stats) return 50;
  const direct = stats[key];
  if (typeof direct === 'number') return direct;
  const legacy = LEGACY_KEY[key];
  if (legacy) {
    const legacyVal = stats[legacy];
    if (typeof legacyVal === 'number') return legacyVal;
  }
  return 50;
}

function getStatCost(value: number): number {
  if (value <= 50) return 5;
  if (value <= 65) return 10;
  if (value <= 75) return 25;
  if (value <= 85) return 60;
  if (value <= 90) return 120;
  return 300;
}

function getInfraLevel(infra: ClubInfrastructure | null, key: BuildingType): number {
  if (!infra) return 1;
  switch (key) {
    case 'stadium': return infra.stadium_level;
    case 'medical': return infra.medical_level;
    case 'academy': return infra.academy_level;
    case 'scout':   return infra.scout_level;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BaseDashboard() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);

  const [activeTab, setActiveTab]           = useState<TabId>('infrastructure');
  const [infra, setInfra]                   = useState<ClubInfrastructure | null>(null);
  const [campData, setCampData]             = useState<TrainingCampData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerForTraining | null>(null);
  const [isLoading, setIsLoading]           = useState(true);

  /**
   * useTransition wraps all mutations (upgrade building, train stat).
   * isPending === true → UI blocks all action buttons, preventing spam clicks
   * and client-side race conditions. Server-side safety is handled by
   * FOR UPDATE row locks in the upgrade_player_stat RPC.
   */
  const [isPending, startTransition] = useTransition();

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchAll = async (currentPlayerId?: string) => {
    if (!userId) return;
    setIsLoading(true);
    const [infraRes, campRes] = await Promise.all([
      getClubInfrastructureData(userId),
      getTrainingCampData(userId),
    ]);
    if (infraRes.success && infraRes.data)  setInfra(infraRes.data);
    if (campRes.success && campRes.data) {
      setCampData(campRes.data);
      // Re-sync selected player (so stat values refresh after training)
      const pid = currentPlayerId ?? selectedPlayer?.id;
      if (pid) {
        const fresh = campRes.data.players.find(p => p.id === pid);
        setSelectedPlayer(fresh ?? campRes.data.players[0] ?? null);
      } else if (campRes.data.players.length > 0) {
        setSelectedPlayer(campRes.data.players[0]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userId) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleUpgrade = (buildingType: BuildingType) => {
    startTransition(async () => {
      const res = await upgradeBuildingAction(buildingType);
      if (res.success) {
        toast.success(`Улучшено до уровня ${res.new_level}! 🎉`, { icon: '🏗️' });
        window.dispatchEvent(new Event('balanceUpdated'));
        await fetchAll(selectedPlayer?.id);
      } else {
        toast.error(res.error ?? 'Ошибка улучшения');
      }
    });
  };

  const handleTrainStat = (statKey: StatKey, currencyType: SpecCurrencyType) => {
    if (!selectedPlayer) return;
    const playerId = selectedPlayer.id;

    startTransition(async () => {
      const res = await trainPlayerStatAction(playerId, statKey, currencyType);
      if (res.success && res.data) {
        toast.success(
          `${res.data.stat_name.toUpperCase()} ${res.data.old_value} → ${res.data.new_value} ✅`,
          { icon: '💪' }
        );
        window.dispatchEvent(new Event('balanceUpdated'));
        // Refetch data and re-sync the selected player with fresh stats
        await fetchAll(playerId);
      } else {
        toast.error(res.error ?? 'Ошибка тренировки');
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-space-dark">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-gray-800/60">
        <BackButton />

        <div className="flex items-center justify-between mt-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neon-cyan/10 rounded-lg flex items-center justify-center border border-neon-cyan/30">
              <Dumbbell className="text-neon-cyan" size={16} />
            </div>
            <h1 className="text-base font-bold font-orbitron text-white uppercase tracking-widest">
              База клуба
            </h1>
          </div>

          {/* FanCoin badge */}
          {infra && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-yellow-700/40 bg-yellow-900/20 text-yellow-400">
              <span className="text-[10px] font-mono font-bold">
                🪙 {infra.fancoins.toLocaleString()} FC
              </span>
            </div>
          )}
        </div>

        {/* Currency ribbon */}
        {campData && (
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { emoji: '🏃', val: campData.currencies.cardio_coin,   cls: 'border-cyan-800/40 bg-cyan-900/20 text-cyan-400' },
                { emoji: '🤸', val: campData.currencies.fitness_coin,  cls: 'border-emerald-800/40 bg-emerald-900/20 text-emerald-400' },
                { emoji: '⚽', val: campData.currencies.ball_coin,     cls: 'border-orange-800/40 bg-orange-900/20 text-orange-400' },
                { emoji: '💪', val: campData.currencies.strength_coin, cls: 'border-rose-800/40 bg-rose-900/20 text-rose-400' },
              ] as const
            ).map((c, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${c.cls}`}
              >
                <span>{c.emoji}</span>
                <span>{c.val}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ── Tab Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-shrink-0 flex border-b border-gray-800/60">
        {(
          [
            { id: 'infrastructure' as TabId, label: 'Инфраструктура' },
            { id: 'training'       as TabId, label: 'Тренировка' },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest font-orbitron transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-neon-cyan border-b-2 border-neon-cyan bg-neon-cyan/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-28">
        {isLoading ? (
          <LoadingPulse />
        ) : activeTab === 'infrastructure' ? (
          <InfrastructureTab
            infra={infra}
            isPending={isPending}
            onUpgrade={handleUpgrade}
          />
        ) : (
          <TrainingTab
            campData={campData}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            onTrainStat={handleTrainStat}
            isPending={isPending}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Pulse
// ─────────────────────────────────────────────────────────────────────────────

function LoadingPulse() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Infrastructure
// ─────────────────────────────────────────────────────────────────────────────

function InfrastructureTab({
  infra,
  isPending,
  onUpgrade,
}: {
  infra: ClubInfrastructure | null;
  isPending: boolean;
  onUpgrade: (key: BuildingType) => void;
}) {
  const fancoins = infra?.fancoins ?? 0;

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
        Клубные здания
      </p>

      {BUILDING_DEFS.map(b => {
        const level      = getInfraLevel(infra, b.key);
        const cost       = level * 1000;
        const canAfford  = fancoins >= cost;
        const Icon       = b.Icon;

        return (
          <div
            key={b.key}
            className={`
              relative overflow-hidden rounded-2xl border
              bg-black/40 ${b.colorBorder} ${b.colorHoverBorder}
              transition-colors duration-200 shadow-lg group
            `}
          >
            {/* Ambient glow blob */}
            <div
              className={`
                absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl
                ${b.colorGlow} group-hover:opacity-200 transition-opacity duration-300
              `}
            />

            <div className="relative z-10 flex items-center justify-between p-4">
              {/* Left: icon + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`
                    w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center
                    border ${b.colorBg} ${b.colorBorder}
                  `}
                >
                  <Icon className={b.colorText} size={22} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-sm font-bold font-orbitron text-white uppercase tracking-widest">
                      {b.label}
                    </h2>
                    <span
                      className={`
                        text-[9px] font-bold font-mono px-1.5 py-0.5 rounded
                        ${b.colorBg} ${b.colorText} border ${b.colorBorder}
                      `}
                    >
                      LVL {level}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight">{b.description}</p>
                  <p className={`text-[10px] font-mono font-bold mt-0.5 ${b.colorText}`}>
                    {b.bonusLabel}
                  </p>
                </div>
              </div>

              {/* Right: upgrade button */}
              <button
                id={`upgrade-${b.key}`}
                onClick={() => onUpgrade(b.key)}
                disabled={isPending || !canAfford}
                className={`
                  ml-3 flex-shrink-0 flex flex-col items-center justify-center
                  px-3 py-2 rounded-xl text-[9px] font-bold font-orbitron uppercase
                  tracking-widest transition-all duration-200 min-w-[64px]
                  ${isPending
                    ? 'bg-gray-800/60 text-gray-500 cursor-wait'
                    : !canAfford
                    ? 'bg-gray-800/40 text-gray-600 border border-gray-700/30 cursor-not-allowed'
                    : `${b.colorBg} ${b.colorText} border ${b.colorBorder}
                       hover:brightness-125 active:scale-95
                       shadow-[0_0_12px_rgba(0,0,0,0.3)]`
                  }
                `}
              >
                {isPending ? (
                  <span>...</span>
                ) : (
                  <>
                    <span>UPGRADE</span>
                    <span className="text-[8px] font-mono opacity-75 mt-0.5">
                      {cost.toLocaleString()} FC
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Level progress dots */}
            <div className="relative z-10 flex gap-1 px-4 pb-3">
              {Array.from({ length: Math.min(level, 10) }).map((_, i) => (
                <span
                  key={i}
                  className={`w-4 h-1 rounded-full ${b.colorBg} border ${b.colorBorder}`}
                  style={{ opacity: 1 - (i * 0.07) }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Training Camp
// ─────────────────────────────────────────────────────────────────────────────

function TrainingTab({
  campData,
  selectedPlayer,
  onSelectPlayer,
  onTrainStat,
  isPending,
}: {
  campData: TrainingCampData | null;
  selectedPlayer: PlayerForTraining | null;
  onSelectPlayer: (p: PlayerForTraining) => void;
  onTrainStat: (key: StatKey, cur: SpecCurrencyType) => void;
  isPending: boolean;
}) {
  if (!campData || campData.players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-4">
        <Users className="text-gray-700" size={32} />
        <p className="text-gray-500 text-sm text-center">
          Нет игроков в команде
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">

      {/* ── Player Carousel ───────────────────────────────────────────────── */}
      <div className="pt-4 px-4">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
          Выбери игрока
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {campData.players.map(player => {
            const isSelected = selectedPlayer?.id === player.id;
            return (
              <button
                key={player.id}
                id={`player-card-${player.id}`}
                onClick={() => onSelectPlayer(player)}
                className={`
                  flex-shrink-0 flex flex-col items-center gap-1.5 p-2.5 rounded-2xl
                  border transition-all duration-200 w-[74px]
                  ${isSelected
                    ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_14px_rgba(0,240,255,0.15)]'
                    : 'bg-black/40 border-gray-800 hover:border-gray-600 active:scale-95'
                  }
                `}
              >
                {/* OVR circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-xs font-bold font-orbitron transition-colors
                    ${isSelected
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'bg-gray-800 text-gray-400'
                    }
                  `}
                >
                  {player.ovr}
                </div>

                {/* Name (last name only) */}
                <span className="text-[9px] font-bold text-white text-center leading-tight line-clamp-2 w-full">
                  {player.name.split(' ').pop()}
                </span>

                {/* Position */}
                <span
                  className={`text-[8px] font-mono uppercase tracking-wider ${
                    isSelected ? 'text-neon-cyan' : 'text-gray-600'
                  }`}
                >
                  {player.position}
                </span>

                {/* Active indicator */}
                {isSelected && (
                  <ChevronRight
                    size={10}
                    className="text-neon-cyan rotate-90"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stat Grid ─────────────────────────────────────────────────────── */}
      {selectedPlayer && (
        <div className="px-4 pt-4 pb-4">
          {/* Selected player info bar */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <p className="text-sm font-bold text-white font-orbitron">
                {selectedPlayer.name}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">
                {selectedPlayer.position} · OVR {selectedPlayer.ovr}
              </p>
            </div>

            {/* Pending indicator */}
            {isPending && (
              <div className="flex items-center gap-1.5 text-neon-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                <span className="text-[10px] font-mono">Тренировка...</span>
              </div>
            )}
          </div>

          {/* 2-column stat grid */}
          <div className="grid grid-cols-2 gap-2">
            {STAT_DEFS.map(stat => {
              const value      = getStatValue(selectedPlayer.stats, stat.key);
              const cost       = getStatCost(value);
              const balance    = campData.currencies[stat.currency];
              const canAfford  = balance >= cost;
              const isMaxed    = value >= 99;

              return (
                <div
                  key={stat.key}
                  className={`
                    relative overflow-hidden rounded-xl border p-3
                    ${stat.colorBg} ${stat.colorBorder}
                    transition-opacity duration-200
                    ${isPending ? 'opacity-60' : 'opacity-100'}
                  `}
                >
                  {/* Stat header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className={`text-[11px] font-bold font-orbitron ${stat.colorText}`}>
                        {stat.label}
                      </span>
                      <p className="text-[8px] text-gray-600 leading-tight">
                        {stat.fullLabel}
                      </p>
                    </div>
                    <span className="text-white font-bold font-mono text-base leading-none">
                      {value}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 bg-gray-700/40 rounded-full mb-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${stat.colorBar}`}
                      style={{ width: `${(value / 99) * 100}%` }}
                    />
                  </div>

                  {/* Footer: currency badge + cost + plus button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px]">{stat.currencyEmoji}</span>
                      <span className={`text-[9px] font-mono font-bold ${stat.colorText}`}>
                        {isMaxed ? 'MAX' : cost}
                      </span>
                    </div>

                    <button
                      id={`train-${selectedPlayer.id}-${stat.key}`}
                      onClick={() => onTrainStat(stat.key, stat.currency)}
                      disabled={isPending || !canAfford || isMaxed}
                      title={
                        isMaxed
                          ? 'Максимальный уровень'
                          : canAfford
                          ? `+1 ${stat.label} за ${cost} ${stat.currencyLabel}`
                          : `Нужно ${cost} ${stat.currencyLabel} (есть ${balance})`
                      }
                      className={`
                        w-7 h-7 rounded-lg flex items-center justify-center
                        text-sm font-bold transition-all duration-150
                        ${isPending
                          ? 'bg-gray-800 text-gray-600 cursor-wait'
                          : isMaxed
                          ? 'bg-gray-800/40 text-gray-700 cursor-default'
                          : !canAfford
                          ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                          : `${stat.colorBg} ${stat.colorText} border ${stat.colorBorder}
                             hover:brightness-150 active:scale-90`
                        }
                      `}
                    >
                      {isMaxed ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Training legend */}
          <div className="mt-4 flex flex-col gap-1.5 px-1">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">
              Прогрессивная стоимость
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { range: '1–50',  cost: '5' },
                  { range: '51–65', cost: '10' },
                  { range: '66–75', cost: '25' },
                  { range: '76–85', cost: '60' },
                  { range: '86–90', cost: '120' },
                  { range: '91–99', cost: '300' },
                ] as const
              ).map(tier => (
                <div
                  key={tier.range}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800/60 rounded border border-gray-700/30"
                >
                  <span className="text-[8px] text-gray-500 font-mono">{tier.range}</span>
                  <span className="text-[8px] text-gray-300 font-bold font-mono">→ {tier.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
