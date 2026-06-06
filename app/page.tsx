'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useTutorial } from '@/components/providers/TutorialContext';
import { usePadding } from '@/components/providers/PaddingContext';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Users, Activity, ShoppingCart, Trophy, ChevronRight, Zap, Lock, User } from 'lucide-react';
import { UnseenMatchesModal } from '@/components/UnseenMatchesModal';
import { NextMatchCountdown } from '@/components/dashboard/NextMatchCountdown';
import { OffseasonCard } from '@/components/dashboard/OffseasonCard';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { motion, AnimatePresence } from 'framer-motion';

import { MatchReport, MatchReportModal } from '@/components/MatchReportModal';
import { OpponentScoutModal } from '@/components/OpponentScoutModal';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — Single Screen Layout (100dvh, no page-level vertical scroll)
// Midnight Command Center aesthetic
// ─────────────────────────────────────────────────────────────────────────────

function MatchCard({ match, teamName, onClick }: { match: any; teamName: string | null; onClick: () => void }) {
  const isHome    = match.home_team?.name === teamName || match.home_team_name === teamName;
  const myScore   = isHome ? match.home_score : match.away_score;
  const theirScore= isHome ? match.away_score : match.home_score;
  const opponent  = isHome ? (match.away_team?.name || match.away_team_name) : (match.home_team?.name || match.home_team_name);
  const result    = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';

  const resultStyle = {
    W: { chip: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300', score: 'text-emerald-300', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
    L: { chip: 'bg-red-500/20 border-red-400/40 text-red-300',            score: 'text-red-300',     glow: 'shadow-[0_0_20px_rgba(239,68,68,0.12)]'  },
    D: { chip: 'bg-gray-500/20 border-gray-400/30 text-gray-400',         score: 'text-gray-300',    glow: '' },
  }[result];

  return (
    <div
      onClick={onClick}
      className={`snap-card w-[120px] flex-shrink-0 rounded-2xl border cursor-pointer
                  transition-all duration-200 active:scale-95 hover:scale-[1.02]
                  glass-card overflow-hidden ${resultStyle.glow}`}
    >
      {/* Result accent top bar */}
      <div className={`h-0.5 w-full ${result === 'W' ? 'bg-emerald-400' : result === 'L' ? 'bg-red-400' : 'bg-gray-600'}`} />
      <div className="p-3 flex flex-col gap-1.5">
        <span className={`text-[9px] font-black font-orbitron self-start px-2 py-0.5 rounded-full border ${resultStyle.chip}`}>
          {result}
        </span>
        <div className={`text-xl font-black font-orbitron ${resultStyle.score} neon-text-${result === 'W' ? 'green' : result === 'L' ? 'violet' : 'cyan'} leading-none`}>
          {myScore}<span className="text-gray-700 text-sm mx-0.5">:</span>{theirScore}
        </div>
        <div className="text-[9px] text-gray-400 font-bold truncate">vs {opponent || '—'}</div>
        <div className="text-[8px] text-gray-600 uppercase tracking-wider font-orbitron">R{match.round_number}</div>
      </div>
    </div>
  );
}

function UpcomingMatchCard({ match, teamName, onClick }: { match: any; teamName: string | null; onClick: () => void }) {
  const isHome       = match.home_team?.name === teamName || match.home_team_name === teamName;
  const opponentName = isHome
    ? (match.away_team?.name || match.away_team_name)
    : (match.home_team?.name || match.home_team_name);

  return (
    <div
      onClick={onClick}
      className="snap-card w-[120px] flex-shrink-0 rounded-2xl cursor-pointer
                 transition-all duration-200 active:scale-95 hover:scale-[1.02]
                 glass-card-violet overflow-hidden"
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-cyan-400" />
      <div className="p-3 flex flex-col gap-1.5">
        <span className="text-[9px] font-black font-orbitron self-start px-2 py-0.5 rounded-full
                         border border-violet-500/40 bg-violet-500/15 text-violet-300">
          R{match.round_number}
        </span>
        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">vs</div>
        <div className="text-[11px] font-black font-orbitron text-white line-clamp-2 leading-tight">
          {opponentName || 'Unknown'}
        </div>
        <div className="text-[8px] text-violet-400/70 uppercase tracking-wider">Scout →</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { step, isDone, nextStep, skipTutorial, setUserId: setTutorialUserId } = useTutorial();
  const router = useRouter();
  const { paddingStyle, setUserId: setPaddingUserId } = usePadding();

  const [hasTeam,          setHasTeam]          = useState<boolean | null>(null);
  const [teamName,         setTeamName]          = useState<string | null>(null);
  const [teamLogoUrl,      setTeamLogoUrl]       = useState<string | null>(null);
  const [teamId,           setTeamId]            = useState<string | null>(null);
  const [players,          setPlayers]           = useState<any[]>([]);
  const [isDataLoading,    setIsDataLoading]     = useState(true);
  const [unseenMatches,    setUnseenMatches]     = useState<any[]>([]);
  const [recentMatches,    setRecentMatches]     = useState<any[]>([]);
  const [upcomingMatches,  setUpcomingMatches]   = useState<any[]>([]);
  const [leagueTier,       setLeagueTier]        = useState<number | null>(null);
  const [lobbyTimeLeft,    setLobbyTimeLeft]     = useState<number | null>(null);
  const [lobbyTeamCount,   setLobbyTeamCount]   = useState<number>(1);
  const [instanceStatus,   setInstanceStatus]   = useState<string | null>(null);
  const [instanceCreatedAt,setInstanceCreatedAt]= useState<string | null>(null);
  const [lastSeasonResult, setLastSeasonResult] = useState<any>(null);
  const [selectedMatch,    setSelectedMatch]    = useState<MatchReport | null>(null);
  const [selectedOpponentId,  setSelectedOpponentId]  = useState<string | null>(null);
  const [selectedOpponentName,setSelectedOpponentName]= useState<string | null>(null);

  const fetchUserData = useCallback(async (id: string) => {
    try {
      const [teamRes, leagueRes] = await Promise.all([
        fetch(`/api/team/my-team?userId=${id}`),
        fetch(`/api/league/standings?userId=${id}`)
      ]);

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
            if (msSinceCreation >= msIn24Hours) {
              setLobbyTimeLeft(3);
            } else {
              setLobbyTimeLeft(0);
            }
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

          fetch(`/api/matches/upcoming?teamId=${teamJson.team.id}&limit=10`)
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
      setTimeout(() => {
        setIsDataLoading(false);
        setHasTeam(true);
      }, 0);
    }
  }, [isAuthenticated, userId, isAuthLoading, fetchUserData, setTutorialUserId, setPaddingUserId]);

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

  // ── Guards ──────────────────────────────────────────────────────────────
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

  const showSpotlightStep1 = !isDone && step === 1;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col overflow-hidden text-white relative"
      style={{ ...paddingStyle, background: '#05060f' }}
    >
      {/* ── Background decorations ────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none bg-grid-cyan opacity-100" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(147,51,234,0.12)_0%,transparent_100%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_30%_at_50%_100%,rgba(0,240,255,0.06)_0%,transparent_100%)]" />

      {/* Tutorial step 0 — shown right after onboarding before SpotlightOverlay kicks in */}
      {!isDone && step === 0 && (
        <div className="absolute top-28 left-0 right-0 z-[100] px-4">
          <div className="glass-card-violet p-3 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-violet-400 flex-shrink-0" />
              <span className="text-xs text-violet-200 font-bold">Добро пожаловать! Давай начнём обучение 🚀</span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => nextStep()}
                className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider
                           shadow-[0_0_10px_rgba(147,51,234,0.5)] hover:bg-violet-400 transition-all active:scale-95"
              >
                Начать
              </button>
              <button
                onClick={() => skipTutorial()}
                className="px-2 py-1.5 rounded-lg text-gray-600 text-[10px] hover:text-gray-400 transition-colors"
              >
                Пропустить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lobby waiting overlay ─────────────────────────────────────────── */}
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
            <h2 className="text-2xl font-black text-white uppercase tracking-widest font-orbitron mb-2">
              WAITING FOR TEAMS
            </h2>
            <p className="text-violet-400 text-xl font-bold mb-8 font-orbitron tracking-widest">
              {lobbyTeamCount} / 14
            </p>
            <div className="glass-card p-4 rounded-xl max-w-sm">
              <p className="text-gray-300 text-sm">Лига заполнится ботами и стартует автоматически.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unseen matches modal ─────────────────────────────────────────── */}
      <UnseenMatchesModal matches={unseenMatches} onAcknowledge={handleAcknowledgeUnseen} />

      {/* ── Tutorial Spotlight ──────────────────────────────────────────── */}
      {showSpotlightStep1 && (
        <SpotlightOverlay
          targetId="tab-lineup"
          title="👟 Твой состав"
          description="Здесь ты управляешь командой. Перемести лучших игроков в стартовый XI!"
          buttonLabel="Посмотреть состав →"
          onNext={() => {
            nextStep();
            router.push('/lineup');
          }}
          onSkip={skipTutorial}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — FRANCHISE COMMAND CARD
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-3 pt-3 flex-shrink-0">
        <motion.div
          className="glass-card-violet relative overflow-hidden p-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          <div className="flex items-center gap-3">
            {/* Team logo — hex shape */}
            <div className="flex-shrink-0 relative">
              <div
                className="w-12 h-12 hex-clip flex items-center justify-center overflow-hidden
                           violet-glow-pulse"
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

            {/* Name + tier + stats */}
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

              {/* Stats row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">OVR</span>
                  <span className="text-sm font-black text-cyan-300 font-orbitron neon-text-cyan">{teamOvr}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">STA</span>
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

          {/* OVR bar */}
          <div className="mt-2.5">
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #9333ea, #00f0ff)', boxShadow: '0 0 8px rgba(147,51,234,0.6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, teamOvr)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — NEXT MATCH COUNTDOWN OR OFFSEASON
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 flex-shrink-0">
        {instanceStatus === 'filling' && instanceCreatedAt &&
         (new Date(instanceCreatedAt).getTime() + 24 * 60 * 60 * 1000) > Date.now() ? (
          <OffseasonCard
            lastSeasonResult={lastSeasonResult}
            instanceCreatedAt={instanceCreatedAt}
            language={language}
          />
        ) : (
          <NextMatchCountdown language={language} />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — QUICK ACTIONS (3-grid)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-3 mt-2 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              href: '/lineup', icon: Users, label: t.dashboard_squad,
              from: 'from-blue-600/20', to: 'to-blue-900/10',
              border: 'border-blue-500/25', text: 'text-blue-300',
              glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]',
              top: 'via-blue-400/40',
            },
            {
              href: '/bank', icon: Activity, label: t.dashboard_training,
              from: 'from-emerald-600/20', to: 'to-emerald-900/10',
              border: 'border-emerald-500/25', text: 'text-emerald-300',
              glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]',
              top: 'via-emerald-400/40',
            },
            {
              href: '/market', icon: ShoppingCart, label: t.dashboard_market,
              from: 'from-amber-600/20', to: 'to-amber-900/10',
              border: 'border-amber-500/25', text: 'text-amber-300',
              glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]',
              top: 'via-amber-400/40',
            },
          ].map(({ href, icon: Icon, from, to, border, glow, text, label, top }) => (
            <Link
              key={href}
              href={href}
              className={`bg-gradient-to-br ${from} ${to} backdrop-blur-md border ${border}
                         rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5
                         hover:scale-[1.04] ${glow} transition-all duration-200 active:scale-95 relative overflow-hidden`}
            >
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${top} to-transparent`} />
              <Icon className={`w-5 h-5 ${text}`} />
              <span className={`text-[9px] font-bold uppercase tracking-widest ${text}`}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — MATCH HISTORY (horizontal snap carousel)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-2 flex-shrink-0 flex flex-col overflow-hidden">
        <div className="px-3 flex items-center justify-between mb-1.5 flex-shrink-0">
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em]">
            {t.match_journal}
          </p>
          <Link href="/league"
            className="text-[9px] text-violet-400 font-bold flex items-center gap-0.5 hover:text-violet-300 transition-colors">
            Все <ChevronRight size={10} />
          </Link>
        </div>

        {recentMatches.length > 0 ? (
          <div className="snap-row px-3 pb-2 flex-shrink-0">
            {recentMatches.map((m, i) => (
              <MatchCard
                key={m.id || i}
                match={m}
                teamName={teamName}
                onClick={() => {
                  setSelectedMatch({
                    id: m.id,
                    home_team_id: m.home_team?.id || '',
                    away_team_id: m.away_team?.id || '',
                    home_team_name: m.home_team?.name || m.home_team_name || 'Unknown',
                    away_team_name: m.away_team?.name || m.away_team_name || 'Unknown',
                    home_score: m.home_score || 0,
                    away_score: m.away_score || 0,
                    events: m.events || [],
                    round_number: m.round_number
                  });
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-gray-700" />
            </div>
            <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">Матчей пока нет</p>
            <p className="text-gray-700 text-[10px] mt-1">Жди следующего раунда лиги</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — UPCOMING MATCHES (horizontal snap carousel)
      ══════════════════════════════════════════════════════════════════ */}
      {upcomingMatches.length > 0 && (
        <div className="flex-shrink-0 mb-1">
          <div className="px-3 flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em]">
              {t.upcoming_matches || 'Предстоящие матчи'}
            </p>
          </div>
          <div className="snap-row px-3 pb-2">
            {upcomingMatches.map((m, i) => (
              <UpcomingMatchCard
                key={m.id || i}
                match={m}
                teamName={teamName}
                onClick={() => {
                  const isHome = m.home_team_id === teamId || m.home_team?.name === teamName;
                  const opponentId = isHome ? m.away_team?.id : m.home_team?.id;
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
        </div>
      )}

      {/* Bottom tab bar spacer */}
      <div className="h-16 flex-shrink-0" />

      {/* ── Match Report Modal ─────────────────────────────────────────── */}
      {selectedMatch && teamId && (
        <MatchReportModal
          report={selectedMatch}
          userTeamId={teamId}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {/* ── Opponent Scout Modal ───────────────────────────────────────── */}
      {selectedOpponentId && teamId && (
        <OpponentScoutModal
          userTeamId={teamId}
          opponentTeamId={selectedOpponentId}
          opponentTeamName={selectedOpponentName || 'Unknown Opponent'}
          onClose={() => {
            setSelectedOpponentId(null);
            setSelectedOpponentName(null);
          }}
        />
      )}
    </div>
  );
}
