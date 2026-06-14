'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { usePageTour } from '@/components/providers/PageTourProvider';
import { usePadding } from '@/components/providers/PaddingContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { CyberLoader } from '@/components/ui/CyberLoader';
import {
  Users, Activity, ShoppingCart, Trophy, ChevronRight,
  Zap, User, TrendingUp, MessageSquare, Globe,
  Shield, Calendar, ArrowRight, Swords, X,
  Dumbbell, Newspaper, Medal, Radio,
} from 'lucide-react';
import { UnseenMatchesModal } from '@/components/UnseenMatchesModal';
import { NextMatchCountdown } from '@/components/dashboard/NextMatchCountdown';
import { DailyQuestsWidget } from '@/components/dashboard/DailyQuestsWidget';
import { OffseasonCard } from '@/components/dashboard/OffseasonCard';
import { NextMatchInfoCard } from '@/components/dashboard/NextMatchInfoCard';
import { UnseenMatchesCard } from '@/components/dashboard/UnseenMatchesCard';
import { FitnessSyncCard } from '@/components/dashboard/FitnessSyncCard';
import { MiniStandingsCard } from '@/components/dashboard/MiniStandingsCard';
import { TeamSummaryCard } from '@/components/dashboard/TeamSummaryCard';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchReport, MatchReportModal } from '@/components/MatchReportModal';
import { OpponentScoutModal } from '@/components/OpponentScoutModal';
import { LandingPage } from '@/components/LandingPage';

// ─────────────────────────────────────────────────────────────────────────────
// HOME DASHBOARD — Premium Dark Glassmorphism
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

// ── Modal Backdrop ─────────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
        <motion.div
          className="relative w-full max-w-[480px] rounded-t-3xl overflow-hidden z-10 border border-white/10"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,30,0.98) 0%, rgba(8,8,20,1) 100%)',
            boxShadow: '0 -20px 80px rgba(0,240,255,0.08), 0 -2px 0 rgba(0,240,255,0.2)',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Standings Modal ────────────────────────────────────────────────────────

function StandingsModal({
  standings,
  userTeamId,
  onClose,
  t,
}: {
  standings: any[];
  userTeamId: string | null;
  onClose: () => void;
  t: any;
}) {
  const top3 = standings.slice(0, 3);
  const userEntry = standings.find((s: any) => s.team_id === userTeamId);
  const userRank = userEntry ? standings.indexOf(userEntry) + 1 : null;

  const medalColors = [
    'text-yellow-400 bg-yellow-500/15 border-yellow-500/40',
    'text-gray-300 bg-gray-500/15 border-gray-500/40',
    'text-orange-400 bg-orange-500/15 border-orange-500/40',
  ];

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-violet-400" />
          <span className="text-[11px] font-black font-orbitron uppercase tracking-widest text-white">
            {t.standings_title || 'League Standings'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center
                     hover:bg-white/10 transition-all duration-300 active:scale-90"
        >
          <X size={13} className="text-gray-400" />
        </button>
      </div>

      <div className="px-5 pb-24 flex flex-col gap-3">
        {standings.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm font-bold uppercase tracking-wider">
            {t.standings_empty || 'No standings data yet'}
          </div>
        ) : (
          <>
            {top3.map((entry: any, i: number) => (
              <motion.div
                key={entry.team_id || i}
                className={`flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-md transition-all duration-300 active:scale-[0.98]
                            ${entry.team_id === userTeamId
                              ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]'
                              : 'bg-white/5 border-white/10 hover:bg-white/8'}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border ${medalColors[i]}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-white uppercase truncate">
                    {entry.team_name || (t.unknown_team || 'Unknown')}
                    {entry.team_id === userTeamId && (
                      <span className="ml-1.5 text-[8px] text-cyan-400 font-bold bg-cyan-500/15 px-1.5 py-0.5 rounded-full">{t.standings_you || 'YOU'}</span>
                    )}
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                    {entry.wins ?? 0}{t.win_short || 'W'} · {entry.draws ?? 0}{t.draw_short || 'D'} · {entry.losses ?? 0}{t.loss_short || 'L'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-black text-white font-orbitron">{entry.points ?? 0}</div>
                  <div className="text-[8px] text-gray-600 uppercase tracking-wider">{t.standings_pts || 'pts'}</div>
                </div>
              </motion.div>
            ))}

            {userEntry && userRank && userRank > 3 && (
              <>
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[8px] text-gray-600 uppercase tracking-wider font-bold">{t.standings_your_position || 'Your Position'}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <motion.div
                  className="flex items-center gap-3 p-3 rounded-2xl border bg-cyan-500/10 border-cyan-500/30 backdrop-blur-md"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                    #{userRank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-cyan-300 uppercase truncate">
                      {userEntry.team_name || (t.standings_your_team || 'Your Team')}
                      <span className="ml-1.5 text-[8px] text-cyan-400 font-bold bg-cyan-500/15 px-1.5 py-0.5 rounded-full">{t.standings_you || 'YOU'}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                      {userEntry.wins ?? 0}{t.win_short || 'W'} · {userEntry.draws ?? 0}{t.draw_short || 'D'} · {userEntry.losses ?? 0}{t.loss_short || 'L'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-black text-cyan-300 font-orbitron">{userEntry.points ?? 0}</div>
                    <div className="text-[8px] text-gray-600 uppercase tracking-wider">{t.standings_pts || 'pts'}</div>
                  </div>
                </motion.div>
              </>
            )}

            <Link
              href="/league"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 mt-1 py-2.5 rounded-2xl
                         border border-violet-500/25 bg-violet-500/10 backdrop-blur-md
                         text-[10px] font-black uppercase tracking-widest text-violet-300
                         hover:bg-violet-500/20 transition-all duration-300 active:scale-95"
            >
              {t.standings_full || 'Full Standings'} <ChevronRight size={11} />
            </Link>
          </>
        )}
      </div>
    </ModalBackdrop>
  );
}

function MatchCard({
  match,
  teamName,
  onClick,
  t,
}: { match: any; teamName: string | null; onClick: () => void; t: any }) {
  const isHome     = match.home_team?.name === teamName || match.home_team_name === teamName;
  const myScore    = isHome ? match.home_score : match.away_score;
  const theirScore = isHome ? match.away_score : match.home_score;
  const opponent   = isHome
    ? (match.away_team?.name || match.away_team_name)
    : (match.home_team?.name || match.home_team_name);
  const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';

  const resultStyle = {
    W: { chip: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300', score: 'text-emerald-300', bar: 'bg-emerald-400', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
    L: { chip: 'bg-red-500/20 border-red-400/40 text-red-300', score: 'text-red-300', bar: 'bg-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.12)]' },
    D: { chip: 'bg-gray-500/20 border-gray-400/30 text-gray-400', score: 'text-gray-300', bar: 'bg-gray-600', glow: '' },
  }[result];

  return (
    <div
      onClick={onClick}
      className={`snap-card w-[118px] flex-shrink-0 rounded-2xl border cursor-pointer
                  transition-all duration-300 active:scale-95 hover:scale-[1.02]
                  backdrop-blur-md overflow-hidden ${resultStyle.glow}
                  bg-white/5 border-white/10 hover:bg-white/8`}
    >
      <div className={`h-0.5 w-full ${resultStyle.bar}`} />
      <div className="p-3 flex flex-col gap-1.5">
        <span className={`text-[9px] font-black font-orbitron self-start px-2 py-0.5 rounded-full border ${resultStyle.chip}`}>
          {result}
        </span>
        <div className={`text-xl font-black font-orbitron ${resultStyle.score} leading-none`}>
          {myScore}<span className="text-gray-700 text-sm mx-0.5">:</span>{theirScore}
        </div>
        <div className="text-[9px] text-gray-400 font-bold truncate">{t.match_vs || 'vs'} {opponent || '—'}</div>
        <div className="text-[8px] text-gray-600 uppercase tracking-wider font-orbitron">{t.match_round?.replace('{round}', String(match.round_number)) || `R${match.round_number}`}</div>
      </div>
    </div>
  );
}

function CalendarMatchRow({
  match,
  teamName,
  index,
  onScout,
  t,
}: { match: any; teamName: string | null; index: number; onScout: () => void; t: any }) {
  const isHome       = match.home_team_id === undefined
    ? match.home_team?.name === teamName || match.home_team_name === teamName
    : match.home_side;
  const opponentName = isHome
    ? (match.away_team?.name || match.away_team_name || 'Unknown')
    : (match.home_team?.name || match.home_team_name || 'Unknown');
  const venue        = isHome ? (t.home_label || 'HOME') : (t.away_label || 'AWAY');
  const venueColor   = isHome ? 'text-emerald-400' : 'text-rose-400';
  const scheduledAt  = match.scheduled_at || match.created_at;

  return (
    <motion.div
      className="flex items-center gap-3 py-2.5 px-3 border-b border-white/[0.06] last:border-b-0"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center
                      bg-violet-500/10 border border-violet-500/25">
        <span className="text-[9px] font-black text-violet-300 font-orbitron">{t.match_round?.replace('{round}', String(match.round_number || '?')) || `R${match.round_number || '?'}`}</span>
      </div>

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

      <button
        onClick={onScout}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                   bg-cyan-500/10 border border-cyan-500/25 text-cyan-400
                   text-[8px] font-bold uppercase tracking-wider
                   hover:bg-cyan-500/20 transition-all duration-300 active:scale-90"
      >
        <Shield size={9} />
        {t.scout_btn || 'Scout'}
      </button>
    </motion.div>
  );
}

function NextHourCountdown() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextHour = new Date(currentTime);
  nextHour.setHours(currentTime.getHours() + 1, 0, 0, 0);
  const diff = nextHour.getTime() - currentTime.getTime();
  
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  const progressPct = ((60 - m) / 60) * 100;

  return (
    <>
      <div className="w-4/5 h-1.5 bg-white/5 rounded-full overflow-hidden mt-1 relative z-10 border border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-all duration-1000 ease-linear rounded-full" 
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="text-[9px] text-cyan-400/80 uppercase tracking-widest font-mono z-10">
        {m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
      </span>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];
  const { startTour, hasSeenTour, areAllToursSkipped } = usePageTour();
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

  // Standings state (fetched on modal open)
  const [standingsData,     setStandingsData]        = useState<any[]>([]);
  const [standingsLoading,  setStandingsLoading]     = useState(false);

  // Modal visibility state
  const [showStandingsModal, setShowStandingsModal]  = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchUserData = useCallback(async (id: string) => {
    try {
      const [teamRes, leagueRes, userRes] = await Promise.all([
        fetch(`/api/team/my-team?userId=${id}`),
        fetch(`/api/league/standings?userId=${id}`),
        fetch(`/api/user/me?userId=${id}`),
      ]);

      if (userRes.ok) {
        const userJson = await userRes.json();
        if (userJson.user) {
          setFcBalance(userJson.user.balance_fancoins ?? 0);
          setYearlyProfit(userJson.user.yearly_profit ?? 0);
          setManagerLevel(userJson.user.manager_level ?? 1);
        }
      }

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
              mod.getLastSeasonResult().then(res => {
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
            mod.getUnseenMatches().then(res => {
              if (res.success && res.matches) setUnseenMatches(res.matches);
            });
          });

          fetch(`/api/matches/recent?teamId=${teamJson.team.id}&limit=10`)
            .then(r => r.ok ? r.json() : { matches: [] })
            .then(d => setRecentMatches(d.matches || []))
            .catch(() => {});

          fetch(`/api/matches/upcoming?teamId=${teamJson.team.id}&limit=5`)
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
        if (lJson.standings) setStandingsData(lJson.standings);
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
        setPaddingUserId(userId);
      }, 0);
    } else if (!isAuthLoading && !isAuthenticated) {
      setTimeout(() => { setIsDataLoading(false); setHasTeam(true); }, 0);
    }
  }, [isAuthenticated, userId, isAuthLoading, fetchUserData, setPaddingUserId]);

  const triggerTour = () => {
    if (areAllToursSkipped()) return;
    startTour('home', [
      {
        targetId: 'tab-lineup',
        title: t.tour_coach_welcome || 'Welcome, Coach!',
        description: t.tour_coach_desc || 'Your team is waiting for instructions.',
      }
    ]);
  };

  useEffect(() => {
    const handleStartTour = () => triggerTour();
    window.addEventListener('startPageTour', handleStartTour);
    
    if (!hasSeenTour('home') && !isDataLoading) {
      const timer = setTimeout(triggerTour, 500);
      return () => clearTimeout(timer);
    }
    
    return () => window.removeEventListener('startPageTour', handleStartTour);
  }, [hasSeenTour, areAllToursSkipped, startTour, isDataLoading]);

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

  const handleOpenStandings = useCallback(async () => {
    setShowStandingsModal(true);
    if (standingsData.length === 0 && userId) {
      setStandingsLoading(true);
      try {
        const res = await fetch(`/api/league/standings?userId=${userId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.standings) setStandingsData(json.standings);
        }
      } finally {
        setStandingsLoading(false);
      }
    }
  }, [userId, standingsData.length]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!isAuthLoading && !userId) {
    return <LandingPage />;
  }

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
      await mod.markMatchesAsViewed(matchIds);
    }
  };

  const nextMatch = upcomingMatches[0] ?? null;
  const isNextHome = nextMatch
    ? (nextMatch.home_team?.name === teamName || nextMatch.home_team_name === teamName)
    : null;
  const nextOpponent = nextMatch
    ? (isNextHome
        ? (nextMatch.away_team?.name || nextMatch.away_team_name)
        : (nextMatch.home_team?.name || nextMatch.home_team_name))
    : null;
  const nextOpponentId = nextMatch
    ? (isNextHome ? (nextMatch.away_team?.id) : (nextMatch.home_team?.id))
    : null;
  const nextOpponentLogo = nextMatch
    ? (isNextHome ? (nextMatch.away_team?.logo_url) : (nextMatch.home_team?.logo_url))
    : null;
  const nextRound = nextMatch?.round_number ?? null;

  const formatProfit = (n: number) => {
    const abs = Math.abs(n);
    const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${abs}`;
    return { str, positive: n >= 0 };
  };
  const profit = formatProfit(yearlyProfit);

  const isOffseason = ['filling', 'completed', 'finished', 'finishing'].includes(instanceStatus ?? '');

  // OVR color coding
  const ovrColor = teamOvr >= 80 ? 'from-yellow-400 to-amber-500' : teamOvr >= 70 ? 'from-gray-300 to-gray-400' : 'from-cyan-400 to-cyan-500';
  const ovrText = teamOvr >= 80 ? 'text-yellow-400' : teamOvr >= 70 ? 'text-gray-300' : 'text-cyan-300';

  return (
    <div
      className="h-full flex flex-col overflow-hidden text-white relative"
      style={{ background: '#0a0a0f' }}
    >
      {/* ── Deep Background with Radial Glows ──────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(147,51,234,0.15)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(0,240,255,0.1)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(147,51,234,0.05)_0%,transparent_70%)]" />
      </div>

      {/* ── Lobby waiting overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {lobbyTimeLeft !== null && lobbyTimeLeft > 0 && (
          <motion.div
            className="fixed inset-0 z-[100] bg-[#0a0a0f]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="w-36 h-36 rounded-full border-2 border-violet-500/40 mb-6
                            flex items-center justify-center
                            shadow-[0_0_80px_rgba(147,51,234,0.5)]"
                 style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.15) 0%, rgba(147,51,234,0.05) 100%)' }}>
              <span className="text-5xl text-violet-300 font-orbitron font-black">{lobbyTimeLeft}s</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest font-orbitron mb-2">{t.waiting_for_teams || 'WAITING FOR TEAMS'}</h2>
            <p className="text-violet-400 text-xl font-bold mb-8 font-orbitron tracking-widest">{t.lobby_teams_count?.replace('{count}', String(lobbyTeamCount)) || `${lobbyTeamCount} / 14`}</p>
            <div className="p-4 rounded-2xl max-w-sm border border-white/10 bg-white/5 backdrop-blur-md">
              <p className="text-gray-300 text-sm">{t.league_auto_start || 'The league will start automatically.'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unseen matches modal ───────────────────────────────────────────── */}
      <UnseenMatchesModal matches={unseenMatches} onAcknowledge={handleAcknowledgeUnseen} />

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN DASHBOARD
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2.5 overflow-hidden relative z-10">

        {/* ── ROW 1: Team Hero Card ──────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <motion.div
            className="relative overflow-hidden p-3 rounded-2xl border border-white/10 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Glass highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="flex items-center gap-3">
              {/* Team logo — glowing hex */}
              <div className="flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(147,51,234,0.3), rgba(0,240,255,0.2))',
                    boxShadow: '0 0 30px rgba(147,51,234,0.3)',
                  }}
                >
                  {teamLogoUrl ? (
                    <img src={teamLogoUrl} alt={teamName || 'Team'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-black font-orbitron text-white">
                      {teamName?.slice(0, 2).toUpperCase() || 'FC'}
                    </span>
                  )}
                </div>
              </div>

              {/* Name + stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
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
                <div className="flex items-center gap-3">
                  {/* OVR — massive and glowing */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">OVR</span>
                    <span className={`text-lg font-black font-orbitron ${ovrText}`}
                          style={{ textShadow: `0 0 20px ${teamOvr >= 80 ? 'rgba(250,204,21,0.4)' : teamOvr >= 70 ? 'rgba(209,213,219,0.3)' : 'rgba(0,240,255,0.4)'}` }}>
                      {teamOvr}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  {/* Stamina */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">STA</span>
                    <span className={`text-sm font-black font-orbitron ${avgStamina < 40 ? 'text-red-400' : 'text-emerald-400'}`}
                          style={{ textShadow: avgStamina >= 40 ? '0 0 12px rgba(52,211,153,0.4)' : 'none' }}>
                      {avgStamina}%
                    </span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  {/* Level */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">LVL</span>
                    <span className="text-sm font-black text-violet-300 font-orbitron">{managerLevel}</span>
                  </div>
                </div>
              </div>

              {/* Profile link — Glassmorphism button */}
              <Link href="/profile"
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                           border border-white/10 bg-white/5 backdrop-blur-md
                           hover:bg-white/10 hover:border-white/20 transition-all duration-300 active:scale-90"
                style={{ boxShadow: '0 0 10px rgba(255,255,255,0.03)' }}>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ── ROW 2: Core Focus — Next Match or Offseason ─────────────────── */}
        <div className="flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            {isOffseason ? (
              <OffseasonCard
                lastSeasonResult={lastSeasonResult}
                instanceCreatedAt={instanceCreatedAt}
                language={language}
              />
            ) : nextMatch ? (
              <NextMatchInfoCard
                opponentName={nextOpponent}
                opponentLogoUrl={nextOpponentLogo}
                roundNumber={nextRound}
                opponentId={nextOpponentId}
                onScout={() => {
                  if (nextOpponentId) {
                    setSelectedOpponentId(nextOpponentId);
                    setSelectedOpponentName(nextOpponent);
                  }
                }}
                language={language}
              />
            ) : (
              <NextMatchCountdown language={language} />
            )}
          </motion.div>
        </div>

        {/* ── ROW 3: Daily Quests ─────────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {userId && <DailyQuestsWidget userId={userId} language={language} />}
          </motion.div>
        </div>

        {/* ── ROW 4: CTA Hub — Unseen Matches + Fitness ──────────────────── */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <UnseenMatchesCard
                count={unseenMatches.length}
                onClick={() => unseenMatches.length > 0 && handleAcknowledgeUnseen(unseenMatches.map(m => m.id))}
                language={language}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <FitnessSyncCard avgStamina={avgStamina} language={language} />
            </motion.div>
          </div>
        </div>

        {/* ── ROW 5: Info Snippets — Mini Standings + Team Summary ────────── */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <MiniStandingsCard
                standings={standingsData}
                userTeamId={teamId}
                language={language}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <TeamSummaryCard
                teamOvr={teamOvr}
                tactic="Balanced"
                avgStamina={avgStamina}
                injuredCount={injuredCount}
                language={language}
              />
            </motion.div>
          </div>
        </div>

        {/* Spacer / Social Hub Placeholder */}
        <div className="flex-1 mt-2 min-h-[80px] flex items-center justify-center relative rounded-2xl border border-dashed border-white/10 bg-white/5 overflow-hidden backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5" />
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
            <Trophy size={100} className="text-white" />
          </div>
          <div className="z-10 flex flex-col items-center justify-center gap-1.5">
            <span className="text-xs font-black font-orbitron uppercase tracking-widest text-white/70">Social Hub</span>
            <span className="text-[9px] uppercase tracking-widest text-cyan-500/70">Coming Soon</span>
          </div>
        </div>
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

      {/* ── Standings Modal ────────────────────────────────────────────────── */}
      {showStandingsModal && (
        <StandingsModal
          standings={standingsLoading ? [] : standingsData}
          userTeamId={teamId}
          onClose={() => setShowStandingsModal(false)}
          t={t}
        />
      )}
    </div>
  );
}
