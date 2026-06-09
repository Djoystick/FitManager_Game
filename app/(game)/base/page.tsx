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
  Store,
  Layers,
} from 'lucide-react';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import {
  getClubInfrastructureData,
  getTrainingCampData,
  upgradeBuildingAction,
  upgradeStadiumFacilityAction,
  batchTrainPlayerAction,
  saveTicketPricesAction,
  type ClubInfrastructure,
  type TrainingCampData,
  type PlayerForTraining,
  type StatKey,
  type SpecCurrencyType,
  type BuildingType,
  type StadiumFacilityType,
} from '@/app/actions/trainingActions';
import toast from 'react-hot-toast';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { useTutorial } from '@/components/providers/TutorialContext';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Static definitions — declared outside component so Tailwind class scanner
// can see all literal class names and include them in the build output.
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'training' | 'club' | 'stadium';

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
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { step, isDone, nextStep, skipTutorial } = useTutorial();
  const router = useRouter();

  const [activeTab, setActiveTab]           = useState<TabId>('training');

  // Force active tab to "club" on step 4 to render the stadium upgrade button for spotlight
  useEffect(() => {
    if (!isDone && step === 4 && activeTab !== 'club') {
      setActiveTab('club');
    }
  }, [step, isDone, activeTab]);
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
    if (isAuthenticated && userId) {
      setTimeout(() => fetchAll(), 0);
    }
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

  const handleUpgradeFacility = (facilityType: StadiumFacilityType) => {
    startTransition(async () => {
      const res = await upgradeStadiumFacilityAction(facilityType);
      if (res.success) {
        toast.success(`Facility улучшена до уровня ${res.new_level}! 🏟️`, { icon: '⬆️' });
        window.dispatchEvent(new Event('balanceUpdated'));
        await fetchAll(selectedPlayer?.id);
      } else {
        toast.error(res.error ?? 'Ошибка улучшения facility');
      }
    });
  };

  const handleBatchTrain = (increments: Record<StatKey, number>) => {
    if (!selectedPlayer) return;
    const playerId = selectedPlayer.id;

    startTransition(async () => {
      const res = await batchTrainPlayerAction(playerId, increments);
      if (res.success) {
        toast.success(`Тренировка прошла успешно! ✅`, { icon: '💪' });
        window.dispatchEvent(new Event('balanceUpdated'));
        await fetchAll(playerId);
      } else {
        toast.error(res.error ?? 'Ошибка тренировки');
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-space-dark">

      {/* Tutorial Spotlight Step 4 */}
      {!isDone && step === 4 && (
        <SpotlightOverlay
          targetId="upgrade-stadium"
          title="🏟️ Улучшение Стадиона"
          description="Это твой стадион. За каждый матч он приносит пассивный доход в FanCoins. Давай перейдем в профиль Менеджера, чтобы настроить твою активность!"
          buttonLabel="В профиль Менеджера →"
          onNext={() => {
            nextStep();
            router.push('/profile');
          }}
          onSkip={skipTutorial}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-3 pt-3 pb-0">
        <div className="glass-card-cyan relative overflow-hidden p-3">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl glass-card flex items-center justify-center border border-cyan-500/25">
                <Dumbbell className="text-cyan-400" size={16} />
              </div>
              <div>
                <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-widest">{t.base_structures || 'Structures'}</h1>
                <p className="text-[8px] text-cyan-400/60 uppercase tracking-wider">{t.base_club_base || 'Club Base'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {infra && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-yellow-700/40 bg-yellow-900/20 text-yellow-400">
                  <span className="text-[9px] font-mono font-bold">🪙 {infra.fancoins.toLocaleString()} FC</span>
                </div>
              )}
            </div>
          </div>
          {/* W2E Currency ribbon */}
          {campData && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {([
                { emoji: '🏃', val: campData.currencies.cardio_coin,   cls: 'border-cyan-800/40 bg-cyan-900/20 text-cyan-400' },
                { emoji: '🤸', val: campData.currencies.fitness_coin,  cls: 'border-emerald-800/40 bg-emerald-900/20 text-emerald-400' },
                { emoji: '⚽', val: campData.currencies.ball_coin,     cls: 'border-orange-800/40 bg-orange-900/20 text-orange-400' },
                { emoji: '💪', val: campData.currencies.strength_coin, cls: 'border-rose-800/40 bg-rose-900/20 text-rose-400' },
              ] as const).map((c, i) => (
                <div key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold font-mono ${c.cls}`}>
                  <span>{c.emoji}</span>
                  <span>{c.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── SubNav Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 py-2">
        <SubNavTabs
          tabs={[
            { id: 'training',  label: t.base_tab_training || 'TRAINING' },
            { id: 'club',      label: t.base_tab_club || 'CLUB' },
            { id: 'stadium',   label: t.base_tab_stadium || 'STADIUM' },
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          accent="cyan"
        />
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-28">
        {isLoading ? (
          <LoadingPulse />
        ) : activeTab === 'training' ? (
          <TrainingTab
            campData={campData}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            onBatchTrain={handleBatchTrain}
            isPending={isPending}
          />
        ) : activeTab === 'club' ? (
          <InfrastructureTab
            infra={infra}
            isPending={isPending}
            onUpgrade={handleUpgrade}
          />
        ) : (
          <StadiumTab
            infra={infra}
            isPending={isPending}
            onUpgrade={handleUpgrade}
            onUpgradeFacility={handleUpgradeFacility}
          />
        )}
      </div>

      <ScreenGuide 
        screenName="training" 
        title={t.training_base_title} 
        content={t.training_base_desc} 
      />
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
// Tab 1: Infrastructure — Premium Redesign
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BUILDING_LEVEL = 10;

function InfrastructureTab({
  infra,
  isPending,
  onUpgrade,
}: {
  infra: ClubInfrastructure | null;
  isPending: boolean;
  onUpgrade: (key: BuildingType) => void;
}) {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const fancoins   = infra?.fancoins ?? 0;
  const totalLevel = BUILDING_DEFS.reduce((sum, b) => sum + getInfraLevel(infra, b.key), 0);
  const totalMax   = BUILDING_DEFS.length * MAX_BUILDING_LEVEL;
  const powerPct   = Math.round((totalLevel / totalMax) * 100);

  return (
    <div className="px-3 py-2 flex flex-col gap-1.5">

      {/* ── Club Power Panel ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow-500/25
                      bg-gradient-to-r from-yellow-900/10 via-black/60 to-amber-900/10
                      p-4 shadow-[0_0_25px_rgba(234,179,8,0.08)]">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl bg-yellow-500/6 pointer-events-none" />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Мощь клуба</p>
            <p className="text-xl font-black font-orbitron text-yellow-400 leading-none">
              {totalLevel} <span className="text-[11px] text-gray-600 font-mono">/ {totalMax}</span>
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Рейтинг базы</div>
            <div className={`text-2xl font-black font-orbitron leading-none ${
              powerPct >= 80 ? 'text-neon-cyan' : powerPct >= 50 ? 'text-violet-400' : 'text-gray-500'
            }`}>{powerPct}%</div>
          </div>
        </div>
        <div className="relative z-10 h-2 bg-black/50 rounded-full overflow-hidden border border-yellow-900/40">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${powerPct}%`,
              background: 'linear-gradient(90deg, rgba(234,179,8,0.6), rgba(251,191,36,0.9), rgba(245,158,11,0.7))',
              boxShadow: '0 0 8px rgba(234,179,8,0.5)',
            }}
          />
        </div>
        <p className="text-[8px] text-gray-700 uppercase tracking-widest font-mono mt-1.5 relative z-10">
          Баланс: {fancoins.toLocaleString()} FanCoins
        </p>
      </div>

      <p className="text-[9px] text-gray-600 uppercase tracking-[0.25em] font-bold px-1 -mb-1">Здания клуба</p>

      {/* ── Building Cards ─────────────────────────────────────────────────── */}
      {BUILDING_DEFS.map(b => {
        const level     = getInfraLevel(infra, b.key);
        const cost      = level * 1000;
        const canAfford = fancoins >= cost;
        const isMaxed   = level >= MAX_BUILDING_LEVEL;
        const Icon      = b.Icon;

        return (
          <div
            key={b.key}
            className={`relative overflow-hidden rounded-2xl border
                        bg-black/50 backdrop-blur-md transition-all duration-300
                        ${ isMaxed
                          ? 'border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.12)]'
                          : `${b.colorBorder} ${b.colorHoverBorder}`
                        }`}
          >
            {/* Ambient glow */}
            <div className={`absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl pointer-events-none ${b.colorGlow} opacity-80`} />

            {/* Main content row */}
            <div className="relative z-10 flex items-center gap-2.5 p-2">
              <div className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center
                               border ${b.colorBg} ${b.colorBorder}
                               shadow-[inset_0_0_12px_rgba(0,0,0,0.4)]`}>
                <Icon className={b.colorText} size={22} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-sm font-black font-orbitron text-white uppercase tracking-wider leading-none">
                    {b.label}
                  </h2>
                  <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded-md
                                   ${ isMaxed
                                     ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                     : `${b.colorBg} ${b.colorText} border ${b.colorBorder}`
                                   }`}>
                    {isMaxed ? '★ MAX' : `LVL ${level}`}
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 leading-snug truncate">{b.description}</p>
                <p className={`text-[9px] font-bold font-mono mt-0.5 ${b.colorText}`}>{b.bonusLabel}</p>
              </div>

              <button
                id={`upgrade-${b.key}`}
                onClick={() => onUpgrade(b.key)}
                disabled={isPending || !canAfford || isMaxed}
                className={`flex-shrink-0 flex flex-col items-center justify-center
                            px-3 py-2 rounded-xl text-[8px] font-black font-orbitron uppercase
                            tracking-wider transition-all duration-200 min-w-[60px] border
                            ${ isPending
                              ? 'bg-gray-800/60 text-gray-500 border-gray-700/30 cursor-wait'
                              : isMaxed
                              ? 'bg-yellow-900/20 text-yellow-600 border-yellow-700/30 cursor-default'
                              : !canAfford
                              ? 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed'
                              : `${b.colorBg} ${b.colorText} ${b.colorBorder} hover:brightness-125 active:scale-95 shadow-[0_0_12px_rgba(0,0,0,0.3)]`
                            }`}
              >
                {isPending ? <span className="animate-pulse">...</span>
                  : isMaxed ? <span>★</span>
                  : <><span>{t.base_up || 'UP'}</span><span className="text-[7px] font-mono opacity-75 mt-0.5">{cost.toLocaleString()}</span></>
                }
              </button>
            </div>

            {/* Segmented level progress bar */}
            <div className="relative z-10 flex gap-0.5 px-2 pb-2">
              {Array.from({ length: MAX_BUILDING_LEVEL }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                    i < level
                      ? isMaxed
                        ? 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.6)]'
                        : b.colorBorder.replace('border-', 'bg-').replace('/40', '/80')
                      : 'bg-white/5'
                  }`}
                  style={{ transitionDelay: `${i * 30}ms` }}
                />
              ))}
            </div>

            {/* Affordable hint */}
            {!canAfford && !isMaxed && !isPending && (
              <p className="relative z-10 px-2 pb-2 -mt-1 text-[8px] text-gray-700 font-mono">
                Нужно ещё {(cost - fancoins).toLocaleString()} FC
              </p>
            )}
          </div>
        );
      })}

      <div className="h-6" />
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
  onBatchTrain,
  isPending,
}: {
  campData: TrainingCampData | null;
  selectedPlayer: PlayerForTraining | null;
  onSelectPlayer: (p: PlayerForTraining) => void;
  onBatchTrain: (increments: Record<StatKey, number>) => void;
  isPending: boolean;
}) {
  const [pendingUpgrades, setPendingUpgrades] = useState<Record<StatKey, number>>({
    pac: 0, sta: 0, agi: 0, def: 0, dri: 0, pas: 0, phy: 0, sho: 0,
  });

  // Reset pending upgrades when player changes
  useEffect(() => {
    setTimeout(() => {
      setPendingUpgrades({ pac: 0, sta: 0, agi: 0, def: 0, dri: 0, pas: 0, phy: 0, sho: 0 });
    }, 0);
  }, [selectedPlayer?.id, campData]);

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

  // Calculate total costs for pending upgrades
  const totalCosts: Record<SpecCurrencyType, number> = {
    cardio_coin: 0, fitness_coin: 0, ball_coin: 0, strength_coin: 0
  };

  let hasPending = false;

  if (selectedPlayer) {
    for (const stat of STAT_DEFS) {
      const inc = pendingUpgrades[stat.key] || 0;
      if (inc > 0) hasPending = true;
      let currentVal = getStatValue(selectedPlayer.stats, stat.key);
      for (let i = 0; i < inc; i++) {
        totalCosts[stat.currency] += getStatCost(currentVal);
        currentVal++;
      }
    }
  }

  const handleAdjust = (key: StatKey, amount: number) => {
    setPendingUpgrades(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + amount)
    }));
  };

  const confirmUpgrades = () => {
    if (!hasPending || isPending) return;
    onBatchTrain(pendingUpgrades);
  };

  return (
    <div className="flex flex-col">

      {/* ── Player Carousel ───────────────────────────────────────────────── */}
      <div className="pt-2 px-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {campData.players.map(player => {
            const isSelected = selectedPlayer?.id === player.id;
            return (
              <button
                key={player.id}
                id={`player-card-${player.id}`}
                onClick={() => onSelectPlayer(player)}
                className={`
                  flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl
                  border transition-all duration-200 w-[68px]
                  ${isSelected
                    ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                    : 'bg-black/40 border-gray-800 hover:border-gray-600 active:scale-95'
                  }
                `}
              >
                {/* OVR circle */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center
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
                <span className="text-[9px] font-bold text-white text-center leading-tight line-clamp-1 w-full">
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
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stat Grid ─────────────────────────────────────────────────────── */}
      {selectedPlayer && (
        <div className="px-4 pt-2 pb-4">
          {/* Selected player info bar */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div>
              <p className="text-sm font-bold text-white font-orbitron">
                {selectedPlayer.name}
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
              const baseValue  = getStatValue(selectedPlayer.stats, stat.key);
              const pendingInc = pendingUpgrades[stat.key] || 0;
              const plannedVal = baseValue + pendingInc;
              const nextCost   = getStatCost(plannedVal);
              const balance    = campData.currencies[stat.currency];
              const usedBalance = totalCosts[stat.currency];
              const remainingBalance = balance - usedBalance;
              const canAffordNext = remainingBalance >= nextCost;
              const isMaxed    = plannedVal >= 99;

              return (
                <div
                  key={stat.key}
                  className={`
                    relative overflow-hidden rounded-xl border p-2
                    ${stat.colorBg} ${stat.colorBorder}
                    transition-opacity duration-200
                    ${isPending ? 'opacity-60' : 'opacity-100'}
                  `}
                >
                  {/* Stat header */}
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className={`text-[10px] font-bold font-orbitron ${stat.colorText}`}>
                        {stat.label}
                      </span>
                    </div>
                    <span className="text-white font-bold font-mono text-sm leading-none flex items-center gap-1">
                      {baseValue}
                      {pendingInc > 0 && <span className="text-neon-green text-[10px]">+ {pendingInc}</span>}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 bg-gray-700/40 rounded-full mb-1.5 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 ${stat.colorBar}`}
                      style={{ width: `${(baseValue / 99) * 100}%` }}
                    />
                    {pendingInc > 0 && (
                      <div
                        className="h-full transition-all duration-500 bg-neon-green/80"
                        style={{ width: `${(pendingInc / 99) * 100}%` }}
                      />
                    )}
                  </div>

                  {/* Footer: + / - buttons and cost */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">{stat.currencyEmoji}</span>
                      <span className={`text-[9px] font-mono font-bold ${stat.colorText}`}>
                        {isMaxed ? 'MAX' : nextCost}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {pendingInc > 0 && (
                        <button
                          onClick={() => handleAdjust(stat.key, -1)}
                          disabled={isPending}
                          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all bg-red-900/40 text-red-400 border border-red-800/40 hover:bg-red-800/60 active:scale-90"
                        >
                          -
                        </button>
                      )}
                      <button
                        onClick={() => handleAdjust(stat.key, 1)}
                        disabled={isPending || !canAffordNext || isMaxed}
                        className={`
                          w-6 h-6 rounded flex items-center justify-center
                          text-xs font-bold transition-all
                          ${isPending
                            ? 'bg-gray-800 text-gray-600 cursor-wait'
                            : isMaxed
                            ? 'bg-gray-800/40 text-gray-700 cursor-default'
                            : !canAffordNext
                            ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                            : `${stat.colorBg} ${stat.colorText} border ${stat.colorBorder} hover:brightness-150 active:scale-90`
                          }
                        `}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirm Button */}
          {hasPending && (
            <button
              onClick={confirmUpgrades}
              disabled={isPending}
              className={`
                mt-4 w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs
                transition-all duration-200
                ${isPending
                  ? 'bg-gray-800 text-gray-500 cursor-wait'
                  : 'bg-neon-cyan text-black hover:bg-neon-cyan/80 shadow-[0_0_15px_rgba(0,255,255,0.4)]'
                }
              `}
            >
              {isPending ? 'Загрузка...' : 'Подтвердить улучшения'}
            </button>
          )}

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StadiumTab — Stadium sub-facilities + ticket pricing (fully wired)
// Sub-facility upgrade cost formula: FLOOR(1500 × level^1.8)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FACILITY_LEVEL = 10;

interface FacilityDef {
  key: StadiumFacilityType;
  label: string;
  emoji: string;
  description: string;
  effectLabel: (level: number) => string;
  colorText: string;
  colorBg: string;
  colorBorder: string;
  colorBar: string;
}

const FACILITY_DEFS: FacilityDef[] = [
  {
    key: 'pitch',
    label: 'Pitch Quality',
    emoji: '🟩',
    description: 'Снижает шанс травмы игроков на матче',
    effectLabel: (lvl) => `−${lvl * 2}% шанс травмы`,
    colorText:   'text-emerald-400',
    colorBg:     'bg-emerald-900/20',
    colorBorder: 'border-emerald-700/40',
    colorBar:    'bg-emerald-500',
  },
  {
    key: 'lighting',
    label: 'Lighting System',
    emoji: '💡',
    description: 'Разблокирует вечерние матчи для бонуса посещаемости',
    effectLabel: (lvl) => lvl >= 3 ? '✅ Вечерние матчи открыты' : `Нужен LVL 3 (сейчас ${lvl})`,
    colorText:   'text-yellow-400',
    colorBg:     'bg-yellow-900/20',
    colorBorder: 'border-yellow-700/40',
    colorBar:    'bg-yellow-400',
  },
  {
    key: 'seating',
    label: 'Seating & VIP',
    emoji: '💺',
    description: 'Мультипликатор дохода с билетов каждый матч',
    effectLabel: (lvl) => `×${(1 + lvl * 0.05).toFixed(2)} ticket revenue`,
    colorText:   'text-violet-400',
    colorBg:     'bg-violet-900/20',
    colorBorder: 'border-violet-700/40',
    colorBar:    'bg-violet-500',
  },
  {
    key: 'services',
    label: 'Fan Services',
    emoji: '🍔',
    description: 'Пассивный доход с мерча и фастфуда per match',
    effectLabel: (lvl) => `+${lvl * 30} FC / матч`,
    colorText:   'text-orange-400',
    colorBg:     'bg-orange-900/20',
    colorBorder: 'border-orange-700/40',
    colorBar:    'bg-orange-400',
  },
];

function facilityLevel(infra: ClubInfrastructure | null, key: StadiumFacilityType): number {
  if (!infra) return 1;
  switch (key) {
    case 'pitch':    return infra.pitch_level    ?? 1;
    case 'lighting': return infra.lighting_level ?? 1;
    case 'seating':  return infra.seating_level  ?? 1;
    case 'services': return infra.services_level ?? 1;
  }
}

function facilityCost(currentLevel: number): number {
  return Math.floor(1500 * Math.pow(currentLevel, 1.8));
}

function StadiumTab({
  infra,
  isPending,
  onUpgrade,
  onUpgradeFacility,
}: {
  infra: ClubInfrastructure | null;
  isPending: boolean;
  onUpgrade: (type: BuildingType) => void;
  onUpgradeFacility: (type: StadiumFacilityType) => void;
}) {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const stadiumLevel = infra?.stadium_level ?? 1;
  const capacity     = stadiumLevel * 5000;
  const fancoins     = infra?.fancoins ?? 0;
  const stadiumCost  = Math.floor(3000 * Math.pow(stadiumLevel, 1.8));

  const [priceLeague,    setPriceLeague]    = useState(infra?.ticket_price_league   ?? 20);
  const [priceIntcup,    setPriceIntcup]    = useState(infra?.ticket_price_intcup   ?? 30);
  const [priceNatcup,    setPriceNatcup]    = useState(infra?.ticket_price_natcup   ?? 25);
  const [priceFriendly,  setPriceFriendly]  = useState(infra?.ticket_price_friendly ?? 10);
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  useEffect(() => {
    if (!infra) return;
    setPriceLeague(infra.ticket_price_league   ?? 20);
    setPriceIntcup(infra.ticket_price_intcup   ?? 30);
    setPriceNatcup(infra.ticket_price_natcup   ?? 25);
    setPriceFriendly(infra.ticket_price_friendly ?? 10);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infra?.ticket_price_league, infra?.ticket_price_intcup,
      infra?.ticket_price_natcup, infra?.ticket_price_friendly]);

  const handleSavePrices = async () => {
    setIsSavingPrices(true);
    try {
      const res = await saveTicketPricesAction({
        league: priceLeague, intcup: priceIntcup,
        natcup: priceNatcup, friendly: priceFriendly,
      });
      if (res.success) toast.success('Ticket prices saved ✅');
      else toast.error(res.error ?? 'Failed to save prices');
    } finally {
      setIsSavingPrices(false);
    }
  };

  const TICKET_ROWS = [
    { label: 'League',   accentColor: 'text-cyan-400',    val: priceLeague,   set: setPriceLeague   },
    { label: 'Int. Cup', accentColor: 'text-violet-400',  val: priceIntcup,   set: setPriceIntcup   },
    { label: 'Nat. Cup', accentColor: 'text-emerald-400', val: priceNatcup,   set: setPriceNatcup   },
    { label: 'Friendly', accentColor: 'text-gray-400',    val: priceFriendly, set: setPriceFriendly },
  ];

  const seatingLevel      = infra?.seating_level ?? 1;
  const previewAttendance = Math.floor(capacity * 0.75);
  const previewBase       = Math.floor((previewAttendance * priceLeague) / 100);
  const previewFinal      = Math.floor(previewBase * (1 + seatingLevel * 0.05));

  return (
    <div className="p-3 flex flex-col gap-3">

      {/* ── Stadium main upgrade card ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/15 via-black/60 to-purple-900/10 p-4 shadow-[0_0_25px_rgba(139,92,246,0.08)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl bg-violet-500/5 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div>
            <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-0.5">Stadium</div>
            <div className="text-sm font-black font-orbitron text-white uppercase">Arena Level {stadiumLevel}</div>
            <div className="text-[9px] text-violet-400 font-mono mt-0.5">Capacity: {capacity.toLocaleString()} fans</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5">Revenue preview</div>
            <div className="text-lg font-black font-orbitron text-violet-300">{previewFinal.toLocaleString()}</div>
            <div className="text-[8px] text-gray-600 font-mono">FC / match (75% fill)</div>
          </div>
        </div>
        <div className="relative z-10 flex gap-0.5 mb-3">
          {Array.from({ length: MAX_BUILDING_LEVEL }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
              i < stadiumLevel
                ? stadiumLevel >= MAX_BUILDING_LEVEL
                  ? 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.6)]'
                  : 'bg-violet-500 shadow-[0_0_4px_rgba(139,92,246,0.6)]'
                : 'bg-white/5'
            }`} style={{ transitionDelay: `${i * 30}ms` }} />
          ))}
        </div>
        <button
          onClick={() => onUpgrade('stadium')}
          disabled={isPending || !infra || stadiumLevel >= MAX_BUILDING_LEVEL}
          className={`relative z-10 w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
            stadiumLevel >= MAX_BUILDING_LEVEL
              ? 'bg-yellow-900/20 text-yellow-600 border border-yellow-700/30 cursor-default'
              : isPending
              ? 'bg-gray-800 text-gray-500 cursor-wait border border-transparent'
              : fancoins >= stadiumCost
              ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 active:scale-95 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
              : 'bg-gray-800/40 border border-gray-700/30 text-gray-600 cursor-not-allowed'
          }`}
        >
          {stadiumLevel >= MAX_BUILDING_LEVEL
            ? '★ MAX LEVEL'
            : isPending ? '...'
            : `Upgrade Arena → ${stadiumCost.toLocaleString()} FC`}
        </button>
        {fancoins < stadiumCost && stadiumLevel < MAX_BUILDING_LEVEL && (
          <p className="relative z-10 text-[8px] text-gray-700 font-mono mt-1.5 text-center">
            Нужно ещё {(stadiumCost - fancoins).toLocaleString()} FC
          </p>
        )}
      </div>

      {/* ── Sub-facility cards ─────────────────────────────────────────────── */}
      <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold px-1">Facilities</div>

      {FACILITY_DEFS.map(f => {
        const level     = facilityLevel(infra, f.key);
        const cost      = facilityCost(level);
        const canAfford = fancoins >= cost;
        const isMaxed   = level >= MAX_FACILITY_LEVEL;

        return (
          <div
            key={f.key}
            className={`relative overflow-hidden rounded-2xl border bg-black/50 transition-all duration-300 ${
              isMaxed ? 'border-yellow-500/40 shadow-[0_0_16px_rgba(234,179,8,0.1)]' : f.colorBorder
            }`}
          >
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl pointer-events-none ${f.colorBg} opacity-60`} />
            <div className="relative z-10 flex items-center gap-3 p-3">
              <div className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center border ${f.colorBg} ${f.colorBorder}`}>
                <span className="text-xl">{f.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-black font-orbitron text-white uppercase tracking-wide">{f.label}</span>
                  <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded-md border ${
                    isMaxed ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : `${f.colorBg} ${f.colorText} ${f.colorBorder}`
                  }`}>{isMaxed ? '★ MAX' : `LVL ${level}`}</span>
                </div>
                <p className="text-[8px] text-gray-600 leading-snug">{f.description}</p>
                <p className={`text-[9px] font-bold font-mono mt-0.5 ${f.colorText}`}>{f.effectLabel(level)}</p>
              </div>
              <button
                id={`upgrade-facility-${f.key}`}
                onClick={() => onUpgradeFacility(f.key)}
                disabled={isPending || !canAfford || isMaxed}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl text-[8px] font-black font-orbitron uppercase tracking-wider transition-all duration-200 min-w-[64px] border ${
                  isPending ? 'bg-gray-800/60 text-gray-500 border-gray-700/30 cursor-wait'
                    : isMaxed ? 'bg-yellow-900/20 text-yellow-600 border-yellow-700/30 cursor-default'
                    : !canAfford ? 'bg-gray-800/40 text-gray-600 border-gray-700/30 cursor-not-allowed'
                    : `${f.colorBg} ${f.colorText} ${f.colorBorder} hover:brightness-125 active:scale-95`
                }`}
              >
                {isPending ? <span className="animate-pulse">...</span>
                  : isMaxed ? <span>★</span>
                  : <><span>{t.base_up || 'UP'}</span><span className="text-[7px] font-mono opacity-70 mt-0.5">{cost.toLocaleString()}</span></>
                }
              </button>
            </div>
            <div className="relative z-10 flex gap-0.5 px-3 pb-3">
              {Array.from({ length: MAX_FACILITY_LEVEL }).map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                  i < level ? isMaxed ? 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.5)]' : f.colorBar : 'bg-white/5'
                }`} style={{ transitionDelay: `${i * 25}ms` }} />
              ))}
            </div>
            {!canAfford && !isMaxed && !isPending && (
              <p className="relative z-10 px-3 pb-2 -mt-1.5 text-[8px] text-gray-700 font-mono">
                Нужно ещё {(cost - fancoins).toLocaleString()} FC
              </p>
            )}
          </div>
        );
      })}

      {/* ── Ticket Pricing ─────────────────────────────────────────────────── */}
      <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold px-1 mt-1">Ticket Pricing</div>
      <div className="relative overflow-hidden rounded-2xl border border-cyan-700/30 bg-black/50 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[8px] text-gray-600 font-mono">Доход = (посетители × цена) / 100 × seating bonus</p>
          <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full border ${
            previewFinal > 500 ? 'text-cyan-400 border-cyan-700/40 bg-cyan-900/20' : 'text-gray-600 border-gray-700/40'
          }`}>~{previewFinal.toLocaleString()} FC</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {TICKET_ROWS.map(({ label, accentColor, val, set }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className={`text-[7px] uppercase tracking-wider font-bold ${accentColor}`}>{label}</div>
              <input
                type="number"
                value={val}
                onChange={e => set(Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)))}
                min={0} max={999}
                className="w-full bg-black/50 border border-white/10 text-white px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold focus:border-cyan-500/40 focus:outline-none [appearance:textfield] transition-all"
                placeholder="FC"
              />
            </div>
          ))}
        </div>
        <button
          id="stadium-save-prices-btn"
          onClick={handleSavePrices}
          disabled={isSavingPrices || isPending}
          className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
            isSavingPrices || isPending
              ? 'bg-gray-800/50 text-gray-500 cursor-wait'
              : 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 active:scale-95 shadow-[0_0_12px_rgba(0,240,255,0.08)]'
          }`}
        >
          {isSavingPrices ? 'Saving...' : '💾 Save Ticket Prices'}
        </button>
      </div>
    </div>
  );
}
