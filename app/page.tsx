'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useTutorial } from '@/components/providers/TutorialContext';
import { usePadding } from '@/components/providers/PaddingContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { CyberLoader } from '@/components/ui/CyberLoader';
import {
  Users, Activity, ShoppingCart, Trophy, ChevronRight,
  Zap, User, TrendingUp, MessageSquare, Globe,
  Shield, Calendar, ArrowRight, Swords,
} from 'lucide-react';
import { UnseenMatchesModal } from '@/components/UnseenMatchesModal';
import { NextMatchCountdown } from '@/components/dashboard/NextMatchCountdown';
import { OffseasonCard } from '@/components/dashboard/OffseasonCard';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchReport, MatchReportModal } from '@/components/MatchReportModal';
import { OpponentScoutModal } from '@/components/OpponentScoutModal';

// ─────────────────────────────────────────────────────────────────────────────
// HOME DASHBOARD — Cyberpunk Command Center
// Layout:
//   1. Franchise Card       — team name + date + OVR bar
//   2. Calendar Card        — next 3 upcoming matches
//   3. Financial Row        — Bank Balance + Yearly Profit
//   4. Action Grid          — Standings · WOOF · Messages
//   5. Match History        — horizontal snap carousel (recent results)
//   6. PROCEED TO MATCH     — large neon CTA button
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMatchDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatMatchTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchCard({
  match,
  teamName,
  onClick,
}: { match: any; teamName: string | null; onClick: () => void }) {
  const isHome     = match.home_team?.name === teamName || match.home_team_name === teamName;
  const myScore    = isHome ? match.home_score : match.away_score;
  const theirScore = isHome ? match.away_score : match.home_score;
  const opponent   = isHome
    ? (match.away_team?.name || match.away_team_name)
    : (match.home_team?.name || match.home_team_name);
  const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';

  const resultStyle = {
    W: { chip: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300', score: 'text-emerald-300', bar: 'bg-emerald-400', glow: 'shadow-[0_0_16px_rgba(52,211,153,0.15)]' },
    L: { chip: 'bg-red-500/20 border-red-400/40 text-red-300',            score: 'text-red-300',     bar: 'bg-red-400',     glow: 'shadow-[0_0_16px_rgba(239,68,68,0.12)]'  },
    D: { chip: 'bg-gray-500/20 border-gray-400/30 text-gray-400',         score: 'text-gray-300',    bar: 'bg-gray-600',    glow: '' },
  }[result];

  return (
    <div
      onClick={onClick}
      className={`snap-card w-[118px] flex-shrink-0 rounded-2xl border cursor-pointer
                  transition-all duration-200 active:scale-95 hover:scale-[1.02]
                  glass-card overflow-hidden ${resultStyle.glow}`}
    >
      <div className={`h-0.5 w-full ${resultStyle.bar}`} />
      <div className="p-3 flex flex-col gap-1.5">
        <span className={`text-[9px] font-black font-orbitron self-start px-2 py-0.5 rounded-full border ${resultStyle.chip}`}>
          {result}
        </span>
        <div className={`text-xl font-black font-orbitron ${resultStyle.score} leading-none`}>
          {myScore}<span className="text-gray-700 text-sm mx-0.5">:</span>{theirScore}
        </div>
        <div className="text-[9px] text-gray-400 font-bold truncate">vs {opponent || '—'}</div>
        <div className="text-[8px] text-gray-600 uppercase tracking-wider font-orbitron">R{match.round_number}</div>
      </div>
    </div>
  );
}

// Calendar row item for an upcoming match
function CalendarMatchRow({
  match,
  teamName,
  index,
  onScout,
}: { match: any; teamName: string | null; index: number; onScout: () => void }) {
  const isHome       = match.home_team_id === undefined
    ? match.home_team?.name === teamName || match.home_team_name === teamName
    : match.home_side;
  const opponentName = isHome
    ? (match.away_team?.name || match.away_team_name || 'Unknown')
    : (match.home_team?.name || match.home_team_name || 'Unknown');
  const venue        = isHome ? 'HOME' : 'AWAY';
  const venueColor   = isHome ? 'text-emerald-400' : 'text-rose-400';
  const scheduledAt  = match.scheduled_at || match.created_at;

  return (
    <motion.div
      className="flex items-center gap-3 py-2 px-3 border-b border-white/[0.04] last:border-b-0"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      {/* Round badge */}
      <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center
                      bg-violet-500/10 border border-violet-500/25">
        <span className="text-[9px] font-black text-violet-300 font-orbitron">R{match.round_number || '?'}</span>
      </div>

      {/* Opponent info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-black text-white uppercase tracking-wide truncate">
          {opponentName}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[8px] font-bold uppercase ${venueColor}`}>{venue}</span>
          {scheduledAt && (
            <>
              <span className="text-gray-700 text-[8px]">·</span>
              <span className="text-[8px] text-gray-600 font-mono">{formatMatchDate(scheduledAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Scout button */}
      <button
        onClick={onScout}
        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg
                   bg-cyan-500/10 border border-cyan-500/25 text-cyan-400
                   text-[8px] font-bold uppercase tracking-wider
                   hover:bg-cyan-500/20 transition-colors active:scale-90"
      >
        <Shield size={9} />
        Scout
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { step, isDone, nextStep, skipTutorial, setUserId: setTutorialUserId } = useTutorial();
  const router = useRouter();
  const { paddingStyle, setUserId: setPaddingUserId } = usePadding();

  // ── State ────────────────────────────────────────────────────────────────
  const [hasTeam,            setHasTeam]            = useState<boolean | null>(null);
  const [teamName,           setTeamName]            = useState<string | null>(null);
  const [teamLogoUrl,        setTeamLogoUrl]         = useState<string | null>(null);
  const [teamId,             setTeamId]              = useState<string | null>(null);
  const [players,            setPlayers]             = useState<any[]>([]);
  const [isDataLoading,      setIsDataLoading]       = useState(true);
  const [unseenMatches,      setUnseenMatches]       = useState<any[]>([]);
  const [recentMatches,      setRecentMatches]       = useState<any[]>([]);
  const [upcomingMatches,    setUpcomingMatches]     = useState<any[]>([]);
  const [leagueTier,         setLeagueTier]          = useState<number | null>(null);
  const [lobbyTimeLeft,      setLobbyTimeLeft]       = useState<number | null>(null);
  const [lobbyTeamCount,     setLobbyTeamCount]      = useState<number>(1);
  const [instanceStatus,     setInstanceStatus]      = useState<string | null>(null);
  const [instanceCreatedAt,  setInstanceCreatedAt]   = useState<string | null>(null);
  const [lastSeasonResult,   setLastSeasonResult]    = useState<any>(null);
  const [selectedMatch,      setSelectedMatch]       = useState<MatchReport | null>(null);
  const [selectedOpponentId,    setSelectedOpponentId]    = useState<string | null>(null);
  const [selectedOpponentName,  setSelectedOpponentName]  = useState<string | null>(null);

  // Financial state
  const [fcBalance,          setFcBalance]           = useState<number>(0);
  const [yearlyProfit,       setYearlyProfit]        = useState<number>(0);
  const [managerLevel,       setManagerLevel]        = useState<number>(1);
  const [unseenMessageCount, setUnseenMessageCount]  = useState<number>(0);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchUserData = useCallback(async (id: string) => {
    try {
      const [teamRes, leagueRes, userRes] = await Promise.all([
        fetch(`/api/team/my-team?userId=${id}`),
        fetch(`/api/league/standings?userId=${id}`),
        fetch(`/api/user/me?userId=${id}`),
      ]);

      // Financial data from user row
      if (userRes.ok) {
        const userJson = await userRes.json();
        if (userJson.user) {
          setFcBalance(userJson.user.balance_fancoins ?? 0);
          setYearlyProfit(userJson.user.yearly_profit ?? 0);
          setManagerLevel(userJson.user.manager_level ?? 1);
        }
      }

      // Team + squad
      if (teamRes.ok) {
        const teamJson = await teamRes.json();
        if (!teamJson.team) {
          setHasTeam(false);
        } else {
          setHasTeam(true);
          setTeamName(teamJson.team.name);
          setTeamLogoUrl(teamJson.team.logo_url);
          setTeamId(teamJson.team.id);
          setPlayers(teamJson.players || []);

          if (teamJson.instanceStatus === 'filling' && teamJson.instanceCreatedAt) {
            setInstanceStatus(teamJson.instanceStatus);
            setInstanceCreatedAt(teamJson.instanceCreatedAt);

            import('@/app/actions/seasonActions').then(mod => {
              mod.getLastSeasonResult(teamJson.team.id).then(res => {
                if (res.success && res.data) setLastSeasonResult(res.data);
              });
            });

            setLobbyTeamCount(teamJson.teamCount || 1);
            const msSinceCreation = Date.now() - new Date(teamJson.instanceCreatedAt).getTime();
            const msIn24Hours = 24 * 60 * 60 * 1000;
            setLobbyTimeLeft(msSinceCreation >= msIn24Hours ? 3 : 0);
          } else {
            setInstanceStatus(teamJson.instanceStatus || 'active');
          }

          import('@/app/actions/matchActions').then(mod => {
            mod.getUnseenMatches(teamJson.team.id).then(res => {
              if (res.success && res.matches) setUnseenMatches(res.matches);
            });
          });

          fetch(`/api/matches/recent?teamId=${teamJson.team.id}&limit=10`)
            .then(r => r.ok ? r.json() : { matches: [] })
            .then(d => setRecentMatches(d.matches || []))
            .catch(() => {});

          fetch(`/api/matches/upcoming?teamId=${teamJson.team.id}&limit=3`)
            .then(r => r.ok ? r.json() : { matches: [] })
            .then(d => setUpcomingMatches(d.matches || []))
            .catch(() => {});
        }
      } else {
        setHasTeam(true);
      }

      if (leagueRes.ok) {
        const lJson = await leagueRes.json();
        if (lJson.league_instance?.tier_level) setLeagueTier(lJson.league_instance.tier_level);
      }
    } catch {
      setHasTeam(true);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      setTimeout(() => {
        fetchUserData(userId);
        setTutorialUserId(userId);
        setPaddingUserId(userId);
      }, 0);
    } else if (!isAuthLoading && !isAuthenticated) {
      setTimeout(() => { setIsDataLoading(false); setHasTeam(true); }, 0);
    }
  }, [isAuthenticated, userId, isAuthLoading, fetchUserData, setTutorialUserId, setPaddingUserId]);

  // Balance event listener
  useEffect(() => {
    const refresh = () => {
      if (userId) {
        fetch(`/api/user/me?userId=${userId}`)
          .then(r => r.json())
          .then(j => {
            if (j.user) {
              setFcBalance(j.user.balance_fancoins ?? 0);
              setYearlyProfit(j.user.yearly_profit ?? 0);
              setManagerLevel(j.user.manager_level ?? 1);
            }
          }).catch(() => {});
      }
    };
    window.addEventListener('balanceUpdated', refresh);
    return () => window.removeEventListener('balanceUpdated', refresh);
  }, [userId]);

  // Lobby countdown timer
  useEffect(() => {
    if (lobbyTimeLeft === null || lobbyTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLobbyTimeLeft(prev => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          fetch('/api/league/trigger-autofill', { method: 'POST' }).then(() => window.location.reload());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lobbyTimeLeft]);

  useEffect(() => {
    if (hasTeam === false && userId) {
      if (typeof window !== 'undefined') window.location.href = '/onboarding';
    }
  }, [hasTeam, userId]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (isAuthLoading || isDataLoading || hasTeam === null) {
    return <CyberLoader fullScreen text={t.loading} />;
  }
  if (hasTeam === false && userId) {
    return <CyberLoader fullScreen text={t.loading} />;
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const teamOvr     = players.length ? Math.round(players.reduce((s, p) => s + (p.ovr || 0), 0) / players.length) : 0;
  const avgStamina  = players.length ? Math.round(players.reduce((s, p) => s + (p.stamina || 0), 0) / players.length) : 0;
  const injuredCount= players.filter(p => p.is_injured).length;

  const handleAcknowledgeUnseen = async (matchIds: string[]) => {
    setUnseenMatches([]);
    if (teamId) {
      const mod = await import('@/app/actions/matchActions');
      await mod.markMatchesAsViewed(matchIds, teamId);
    }
  };

  const showSpotlightStep0 = !isDone && step === 0;

  // Next upcoming match (first one)
  const nextMatch = upcomingMatches[0] ?? null;
  const isNextHome = nextMatch
    ? (nextMatch.home_team?.name === teamName || nextMatch.home_team_name === teamName)
    : null;
  const nextOpponent = nextMatch
    ? (isNextHome
        ? (nextMatch.away_team?.name || nextMatch.away_team_name)
        : (nextMatch.home_team?.name || nextMatch.home_team_name))
    : null;

  // Profit formatting
  const formatProfit = (n: number) => {
    const abs = Math.abs(n);
    const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${abs}`;
    return { str, positive: n >= 0 };
  };
  const profit = formatProfit(yearlyProfit);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col overflow-y-auto custom-scrollbar text-white relative"
      style={{ ...paddingStyle, background: '#05060f' }}
    >
      {/* ── Background decorations ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-100" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(147,51,234,0.12)_0%,transparent_100%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_30%_at_50%_100%,rgba(0,240,255,0.06)_0%,transparent_100%)]" />

      {/* ── Tutorial ───────────────────────────────────────────────────────── */}
      {showSpotlightStep0 && (
        <SpotlightOverlay
          targetId="tab-lineup"
          title="Добро пожаловать, Тренер!"
          description="Твоя команда ждет указаний. Давай перейдем в раздел Состав и расставим игроков по позициям!"
          buttonLabel="Перейти к составу →"
          onNext={() => { nextStep(); router.push('/lineup'); }}
          onSkip={skipTutorial}
        />
      )}

      {/* ── Lobby waiting overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {lobbyTimeLeft !== null && lobbyTimeLeft > 0 && (
          <motion.div
            className="fixed inset-0 z-[100] bg-[#05060f]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="w-32 h-32 rounded-full border-2 border-violet-500/40 mb-6
                            flex items-center justify-center
                            shadow-[0_0_60px_rgba(147,51,234,0.4)] violet-glow-pulse"
                 style={{ background: 'rgba(147,51,234,0.08)' }}>
              <span className="text-4xl text-violet-300 font-orbitron font-black">{lobbyTimeLeft}s</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest font-orbitron mb-2">WAITING FOR TEAMS</h2>
            <p className="text-violet-400 text-xl font-bold mb-8 font-orbitron tracking-widest">{lobbyTeamCount} / 14</p>
            <div className="glass-card p-4 rounded-xl max-w-sm">
              <p className="text-gray-300 text-sm">Лига заполнится ботами и стартует автоматически.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unseen matches modal ───────────────────────────────────────────── */}
      <UnseenMatchesModal matches={unseenMatches} onAcknowledge={handleAcknowledgeUnseen} />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — FRANCHISE COMMAND CARD
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-3 pt-3 pb-0 flex-shrink-0 relative z-10">
        <motion.div
          className="glass-card-violet relative overflow-hidden p-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          <div className="flex items-center gap-3">
            {/* Team logo */}
            <div className="flex-shrink-0">
              <div
                className="w-12 h-12 hex-clip flex items-center justify-center overflow-hidden violet-glow-pulse"
                style={{ background: 'linear-gradient(135deg,rgba(147,51,234,0.3),rgba(0,240,255,0.2))' }}
              >
                {teamLogoUrl ? (
                  <img src={teamLogoUrl} alt={teamName || 'Team'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-black font-orbitron text-white">
                    {teamName?.slice(0, 2).toUpperCase() || 'FC'}
                  </span>
                )}
              </div>
            </div>

            {/* Name + date + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-sm font-black font-orbitron text-white truncate uppercase tracking-wide">
                  {teamName}
                </h1>
                {leagueTier && (
                  <span className="flex-shrink-0 text-[8px] font-bold bg-violet-500/20 border border-violet-500/40
                                   text-violet-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    T{leagueTier}
                  </span>
                )}
              </div>

              {/* Date line */}
              <div className="text-[8px] text-gray-600 uppercase tracking-[0.2em] font-bold mb-1">
                {getTodayLabel()}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-gray-600 uppercase tracking-wider">OVR</span>
                  <span className="text-sm font-black text-cyan-300 font-orbitron neon-text-cyan">{teamOvr}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-gray-600 uppercase tracking-wider">STA</span>
                  <span className={`text-sm font-black font-orbitron ${avgStamina < 40 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {avgStamina}%
                  </span>
                </div>
                {injuredCount > 0 && (
                  <>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="text-[9px] text-red-400 font-bold">🤕 {injuredCount}</span>
                  </>
                )}
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-gray-600 uppercase tracking-wider">LVL</span>
                  <span className="text-sm font-black text-violet-300 font-orbitron">{managerLevel}</span>
                </div>
              </div>
            </div>

            {/* Profile link */}
            <Link href="/profile"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                         border border-white/10 bg-white/5 hover:border-violet-500/40 hover:bg-violet-500/10
                         transition-all duration-200 active:scale-90">
              <User size={14} className="text-gray-400" />
            </Link>
          </div>

          {/* OVR gradient bar */}
          <div className="mt-2.5">
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#9333ea,#00f0ff)', boxShadow: '0 0 8px rgba(147,51,234,0.6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, teamOvr)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — CALENDAR CARD (Next 3 Matches)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 flex-shrink-0 relative z-10">
        <motion.div
          className="glass-card overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          {/* Card header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-cyan-400" />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                Upcoming Fixtures
              </span>
            </div>
            <Link href="/league"
              className="text-[8px] text-violet-400 font-bold flex items-center gap-0.5 hover:text-violet-300 transition-colors">
              League <ChevronRight size={9} />
            </Link>
          </div>

          {/* Next match countdown component (existing logic) */}
          {instanceStatus === 'filling' && instanceCreatedAt &&
           (new Date(instanceCreatedAt).getTime() + 24 * 60 * 60 * 1000) > Date.now() ? (
            <div className="px-3 py-2">
              <OffseasonCard
                lastSeasonResult={lastSeasonResult}
                instanceCreatedAt={instanceCreatedAt}
                language={language}
              />
            </div>
          ) : upcomingMatches.length > 0 ? (
            <div>
              {upcomingMatches.slice(0, 3).map((m, i) => (
                <CalendarMatchRow
                  key={m.id || i}
                  match={m}
                  teamName={teamName}
                  index={i}
                  onScout={() => {
                    const isHome = m.home_team?.name === teamName || m.home_team_name === teamName;
                    const opponentId   = isHome ? m.away_team?.id : m.home_team?.id;
                    const opponentName = isHome
                      ? (m.away_team?.name || m.away_team_name)
                      : (m.home_team?.name || m.home_team_name);
                    if (opponentId) {
                      setSelectedOpponentId(opponentId);
                      setSelectedOpponentName(opponentName);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            // Fallback: show the countdown component
            <div className="px-3 py-2">
              <NextMatchCountdown language={language} />
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — FINANCIAL ROW
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 flex-shrink-0 relative z-10">
        <motion.div
          className="grid grid-cols-2 gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          {/* Bank Balance */}
          <Link href="/bank"
            className="relative overflow-hidden rounded-2xl border border-yellow-500/25 bg-yellow-900/10
                       p-3 flex flex-col gap-0.5 hover:border-yellow-500/40 hover:bg-yellow-900/15
                       transition-all duration-200 active:scale-95 group">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
            <div className="text-[7px] text-gray-600 uppercase tracking-[0.18em] font-bold">Bank Balance</div>
            <div className="text-lg font-black font-orbitron text-yellow-400 leading-none group-hover:text-yellow-300 transition-colors">
              {fcBalance.toLocaleString()}
            </div>
            <div className="text-[7px] text-yellow-600 font-bold uppercase tracking-wider">FanCoin (FC)</div>
          </Link>

          {/* Yearly Profit */}
          <div className="relative overflow-hidden rounded-2xl border
                          p-3 flex flex-col gap-0.5
                          transition-all duration-200"
               style={{
                 borderColor: profit.positive ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)',
                 background:  profit.positive ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
               }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="text-[7px] text-gray-600 uppercase tracking-[0.18em] font-bold">Yearly Profit</div>
            <div className={`text-lg font-black font-orbitron leading-none flex items-center gap-1
                            ${profit.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className="text-sm">{profit.positive ? '▲' : '▼'}</span>
              {profit.str}
            </div>
            <div className={`text-[7px] font-bold uppercase tracking-wider
                             ${profit.positive ? 'text-emerald-700' : 'text-red-700'}`}>
              {profit.positive ? 'Net Gain' : 'Net Loss'} · Season
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — ACTION GRID (Standings · WOOF · Messages)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 flex-shrink-0 relative z-10">
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          {/* Standings */}
          <Link href="/league"
            className="relative overflow-hidden rounded-2xl border border-violet-500/25
                       bg-gradient-to-br from-violet-900/20 to-black/40
                       p-3 flex flex-col items-center justify-center gap-1.5
                       hover:border-violet-500/50 hover:scale-[1.03]
                       transition-all duration-200 active:scale-95 group">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
            <div className="w-8 h-8 rounded-xl flex items-center justify-center
                            bg-violet-500/15 border border-violet-500/30
                            group-hover:bg-violet-500/25 transition-colors">
              <Trophy size={16} className="text-violet-400" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-violet-300">STANDINGS</span>
          </Link>

          {/* WOOF Social */}
          <Link href="/league"
            className="relative overflow-hidden rounded-2xl border border-cyan-500/25
                       bg-gradient-to-br from-cyan-900/20 to-black/40
                       p-3 flex flex-col items-center justify-center gap-1.5
                       hover:border-cyan-500/50 hover:scale-[1.03]
                       transition-all duration-200 active:scale-95 group">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div className="w-8 h-8 rounded-xl flex items-center justify-center
                            bg-cyan-500/15 border border-cyan-500/30
                            group-hover:bg-cyan-500/25 transition-colors">
              <Globe size={16} className="text-cyan-400" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">WOOF 🐾</span>
          </Link>

          {/* Messages */}
          <button
            className="relative overflow-hidden rounded-2xl border border-emerald-500/25
                       bg-gradient-to-br from-emerald-900/20 to-black/40
                       p-3 flex flex-col items-center justify-center gap-1.5
                       hover:border-emerald-500/50 hover:scale-[1.03]
                       transition-all duration-200 active:scale-95 group"
            onClick={() => router.push('/profile')}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <div className="w-8 h-8 rounded-xl flex items-center justify-center relative
                            bg-emerald-500/15 border border-emerald-500/30
                            group-hover:bg-emerald-500/25 transition-colors">
              <MessageSquare size={16} className="text-emerald-400" />
              {unseenMessageCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center
                                 text-[7px] font-black text-white shadow-[0_0_6px_rgba(239,68,68,0.6)]">
                  {unseenMessageCount}
                </span>
              )}
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-300">MESSAGES</span>
          </button>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — MATCH HISTORY (horizontal snap carousel)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-2 flex-shrink-0 relative z-10">
        <div className="px-3 flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em]">
            {t.match_journal}
          </p>
          <Link href="/league"
            className="text-[9px] text-violet-400 font-bold flex items-center gap-0.5 hover:text-violet-300 transition-colors">
            All <ChevronRight size={10} />
          </Link>
        </div>

        {recentMatches.length > 0 ? (
          <div className="snap-row px-3 pb-2">
            {recentMatches.map((m, i) => (
              <MatchCard
                key={m.id || i}
                match={m}
                teamName={teamName}
                onClick={() => setSelectedMatch({
                  id: m.id,
                  home_team_id:   m.home_team?.id || '',
                  away_team_id:   m.away_team?.id || '',
                  home_team_name: m.home_team?.name || m.home_team_name || 'Unknown',
                  away_team_name: m.away_team?.name || m.away_team_name || 'Unknown',
                  home_score:     m.home_score || 0,
                  away_score:     m.away_score || 0,
                  events:         m.events || [],
                  round_number:   m.round_number,
                })}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-6">
            <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-gray-700" />
            </div>
            <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">No matches yet</p>
            <p className="text-gray-700 text-[10px] mt-1">Wait for the next league round</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6 — PROCEED TO NEXT MATCH (large neon CTA)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 pb-28 flex-shrink-0 relative z-10">
        {nextMatch ? (
          <motion.button
            onClick={() => {
              const isHome = nextMatch.home_team?.name === teamName || nextMatch.home_team_name === teamName;
              const opponentId   = isHome ? nextMatch.away_team?.id : nextMatch.home_team?.id;
              const opponentName = isHome
                ? (nextMatch.away_team?.name || nextMatch.away_team_name)
                : (nextMatch.home_team?.name || nextMatch.home_team_name);
              if (opponentId) {
                setSelectedOpponentId(opponentId);
                setSelectedOpponentName(opponentName);
              }
            }}
            className="w-full relative overflow-hidden rounded-2xl py-4 flex flex-col items-center justify-center gap-1
                       transition-all duration-300 active:scale-[0.98] group"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.12) 0%, rgba(147,51,234,0.15) 100%)',
              border: '1px solid rgba(0,240,255,0.35)',
              boxShadow: '0 0 30px rgba(0,240,255,0.15), inset 0 0 30px rgba(147,51,234,0.05)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Animated top border */}
            <div className="absolute top-0 left-0 right-0 h-px"
                 style={{ background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.8), rgba(147,51,234,0.8), transparent)' }} />

            {/* Ambient glow blob */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,240,255,0.05) 0%, transparent 70%)' }} />

            {/* Icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1
                            bg-cyan-500/15 border border-cyan-400/30
                            group-hover:bg-cyan-500/25 group-hover:border-cyan-400/50
                            transition-all duration-200">
              <Swords size={20} className="text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            </div>

            <span className="text-xs font-black font-orbitron uppercase tracking-widest text-white"
                  style={{ textShadow: '0 0 20px rgba(0,240,255,0.6)' }}>
              PROCEED TO NEXT MATCH
            </span>
            {nextOpponent && (
              <span className="text-[9px] text-cyan-400/70 uppercase tracking-wider font-bold">
                vs {nextOpponent} · R{nextMatch.round_number}
              </span>
            )}
          </motion.button>
        ) : (
          // No upcoming match — show the standard countdown component
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <NextMatchCountdown language={language} />
          </motion.div>
        )}
      </div>

      {/* ── Match Report Modal ─────────────────────────────────────────────── */}
      {selectedMatch && teamId && (
        <MatchReportModal
          report={selectedMatch}
          userTeamId={teamId}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {/* ── Opponent Scout Modal ───────────────────────────────────────────── */}
      {selectedOpponentId && teamId && (
        <OpponentScoutModal
          userTeamId={teamId}
          opponentTeamId={selectedOpponentId}
          opponentTeamName={selectedOpponentName || 'Unknown Opponent'}
          onClose={() => { setSelectedOpponentId(null); setSelectedOpponentName(null); }}
        />
      )}
    </div>
  );
}
