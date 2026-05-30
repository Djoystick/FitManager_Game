'use client';

import { useContext, useEffect, useState, useCallback } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useTutorial } from '@/components/providers/TutorialContext';
import { usePadding } from '@/components/providers/PaddingContext';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Users, Activity, ShoppingCart, Trophy, ChevronRight, Zap } from 'lucide-react';
import { UnseenMatchesModal } from '@/components/UnseenMatchesModal';
import { NextMatchCountdown } from '@/components/dashboard/NextMatchCountdown';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — Single Screen Layout (100dvh, no page-level vertical scroll)
//
// Layout:
//   ┌──────────────────────┐
//   │  Franchise Card      │  fixed height
//   │  Next Match          │  fixed height
//   ├──────────────────────┤
//   │  Quick Actions       │  fixed height (3-grid)
//   ├──────────────────────┤
//   │  Match History       │  horizontal snap-scroll carousel
//   └──────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

// Compact match history card for horizontal scroll
function MatchCard({ match, teamName }: { match: any; teamName: string | null }) {
  const isHome  = match.home_team?.name === teamName || match.home_team_name === teamName;
  const myScore = isHome ? match.home_score : match.away_score;
  const theirScore = isHome ? match.away_score : match.home_score;
  const opponent = isHome ? (match.away_team?.name || match.away_team_name) : (match.home_team?.name || match.home_team_name);
  const result   = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';
  const colors   = { W: 'text-green-400 border-green-500/40 bg-green-500/10', L: 'text-red-400 border-red-500/40 bg-red-500/10', D: 'text-gray-400 border-gray-500/40 bg-gray-500/10' };

  return (
    <div className={`snap-card w-36 flex-shrink-0 rounded-2xl border p-3 flex flex-col gap-1
                     bg-black/40 backdrop-blur-md ${colors[result]}`}>
      <div className={`text-xs font-black font-orbitron self-start px-2 py-0.5 rounded-full border ${colors[result]}`}>
        {result}
      </div>
      <div className="text-xl font-black font-orbitron text-white mt-1">
        {myScore} <span className="text-gray-600 text-base">:</span> {theirScore}
      </div>
      <div className="text-[10px] text-gray-400 font-bold truncate">
        vs {opponent || '—'}
      </div>
      <div className="text-[9px] text-gray-600 uppercase tracking-wider">
        R{match.round_number}
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
  const { paddingStyle, setUserId: setPaddingUserId } = usePadding();

  const [hasTeam,       setHasTeam]       = useState<boolean | null>(null);
  const [teamName,      setTeamName]      = useState<string | null>(null);
  const [teamLogoUrl,   setTeamLogoUrl]   = useState<string | null>(null);
  const [teamId,        setTeamId]        = useState<string | null>(null);
  const [players,       setPlayers]       = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [unseenMatches, setUnseenMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [leagueTier,    setLeagueTier]    = useState<number | null>(null);
  const [lobbyTimeLeft, setLobbyTimeLeft] = useState<number | null>(null);
  const [lobbyTeamCount,setLobbyTeamCount]= useState<number>(1);

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
            setLobbyTeamCount(teamJson.teamCount || 1);
            const diff = 60000 - (Date.now() - new Date(teamJson.instanceCreatedAt).getTime());
            setLobbyTimeLeft(diff > 0 ? Math.floor(diff / 1000) : 0);
          }

          import('@/app/actions/matchActions').then(mod => {
            mod.getUnseenMatches(teamJson.team.id).then(res => {
              if (res.success && res.matches) setUnseenMatches(res.matches);
            });
          });

          // Fetch recent matches for horizontal scroll
          fetch(`/api/matches/recent?teamId=${teamJson.team.id}&limit=10`)
            .then(r => r.ok ? r.json() : { matches: [] })
            .then(d => setRecentMatches(d.matches || []))
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

  // Lobby countdown
  useEffect(() => {
    if (lobbyTimeLeft === null || lobbyTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLobbyTimeLeft(prev => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          fetch('/api/cron/league-autofill').then(() => window.location.reload());
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

  // ── Tutorial: step 1 spotlight targets "tab-lineup"
  const showSpotlightStep1 = !isDone && step === 1;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#060913] text-white relative"
         style={paddingStyle}>

      {/* ── Background grid ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
           style={{ backgroundImage: 'linear-gradient(rgba(0,240,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,240,255,0.06)_0%,transparent_100%)]" />

      {/* ── Manual Skip Onboarding Button (Temporary/Debug Fix) ─────────── */}
      {!isDone && (
        <div className="absolute top-16 left-0 right-0 z-50 px-4">
          <button
            onClick={() => {
              skipTutorial();
              localStorage.setItem('fitmanager_tour_completed_v2', 'true');
            }}
            className="w-full bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold backdrop-blur-md animate-pulse"
          >
            <Lock size={18} />
            <span>Пройти обучение (Разблокировать меню)</span>
          </button>
        </div>
      )}

      {/* ── Lobby waiting overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {lobbyTimeLeft !== null && lobbyTimeLeft > 0 && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="w-32 h-32 rounded-full border-4 border-cyan-500/40 mb-6
                            flex items-center justify-center bg-black/60
                            shadow-[0_0_40px_rgba(0,240,255,0.4)] neon-glow-pulse">
              <span className="text-5xl text-cyan-400 font-orbitron font-black">{lobbyTimeLeft}s</span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-widest font-orbitron mb-2">
              WAITING FOR TEAMS
            </h2>
            <p className="text-cyan-400 text-2xl font-bold mb-8 font-orbitron tracking-widest">
              {lobbyTeamCount} / 14
            </p>
            <div className="bg-gray-900 border border-cyan-500/30 p-4 rounded-xl max-w-sm">
              <p className="text-gray-300 text-sm">
                Лига заполнится ботами и стартует автоматически.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unseen matches modal ─────────────────────────────────────────── */}
      <UnseenMatchesModal matches={unseenMatches} onAcknowledge={handleAcknowledgeUnseen} />

      {/* ── Tutorial Spotlight: step 1 → highlight Squad tab ──────────────── */}
      {showSpotlightStep1 && (
        <SpotlightOverlay
          targetId="tab-lineup"
          title="👟 Твой состав"
          description="Здесь ты управляешь командой. Перемести лучших игроков в стартовый XI!"
          buttonLabel="Посмотреть состав →"
          onNext={nextStep}
          onSkip={() => {}}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — FRANCHISE CARD
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 pt-3 flex-shrink-0">
        <motion.div
          className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-4
                     shadow-[0_0_30px_rgba(0,240,255,0.08)] relative overflow-hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          <div className="flex items-center gap-3">
            {/* Team logo */}
            <div className="w-14 h-14 bg-gray-900 border-2 border-cyan-500/40 rounded-full
                            flex items-center justify-center flex-shrink-0
                            shadow-[0_0_20px_rgba(0,240,255,0.2)] overflow-hidden">
              {teamLogoUrl ? (
                <img src={teamLogoUrl} alt={teamName || 'Team'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black font-orbitron text-white">
                  {teamName?.slice(0, 2).toUpperCase() || 'FC'}
                </span>
              )}
            </div>

            {/* Name + tier */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-base font-black font-orbitron text-white truncate uppercase">
                  {teamName}
                </h1>
                {leagueTier && (
                  <span className="flex-shrink-0 text-[9px] font-bold bg-purple-500/20 border border-purple-500/40
                                   text-purple-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Tier {leagueTier}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">OVR</span>
                  <span className="text-sm font-black text-cyan-400 font-orbitron">{teamOvr}</span>
                </div>
                <div className="w-px h-3 bg-gray-700" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">STA</span>
                  <span className={`text-sm font-black font-orbitron ${avgStamina < 40 ? 'text-red-400' : 'text-green-400'}`}>
                    {avgStamina}%
                  </span>
                </div>
                {injuredCount > 0 && (
                  <>
                    <div className="w-px h-3 bg-gray-700" />
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-red-400 font-bold">🤕 {injuredCount}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Settings */}
            <Link href="/profile"
              className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700
                         flex items-center justify-center hover:border-cyan-500/40
                         transition-colors active:scale-90 flex-shrink-0">
              <span className="text-gray-400 text-sm">⚙️</span>
            </Link>
          </div>

          {/* OVR bar */}
          <div className="mt-3">
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, teamOvr)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ boxShadow: '0 0 8px rgba(0,240,255,0.6)' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — NEXT MATCH COUNTDOWN
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 mt-3 flex-shrink-0">
        <NextMatchCountdown language={language} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — QUICK ACTIONS (3-grid)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 mt-3 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-2 ml-1">
          {t.quick_actions}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: '/lineup', icon: Users,        color: 'from-blue-600/20 to-blue-900/10',    border: 'border-blue-500/30',    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',    text: 'text-blue-300',    label: t.dashboard_squad    },
            { href: '/training',icon: Activity,    color: 'from-emerald-600/20 to-emerald-900/10',border:'border-emerald-500/30', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]',  text: 'text-emerald-300', label: t.dashboard_training },
            { href: '/market',  icon: ShoppingCart,color: 'from-amber-600/20 to-amber-900/10',   border: 'border-amber-500/30',   glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]',   text: 'text-amber-300',   label: t.dashboard_market   },
          ].map(({ href, icon: Icon, color, border, glow, text, label }) => (
            <Link
              key={href}
              href={href}
              className={`bg-gradient-to-br ${color} backdrop-blur-md border ${border}
                         rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5
                         hover:scale-105 ${glow} transition-all duration-200 active:scale-95`}
            >
              <Icon className={`w-5 h-5 ${text}`} />
              <span className={`text-[9px] font-bold uppercase tracking-widest ${text}`}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — MATCH HISTORY (horizontal snap-scroll)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="px-4 flex items-center justify-between mb-2 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">
            {t.match_journal}
          </p>
          <Link href="/league"
            className="text-[10px] text-cyan-500 font-bold flex items-center gap-0.5 hover:text-cyan-300 transition-colors">
            Все <ChevronRight size={10} />
          </Link>
        </div>

        {recentMatches.length > 0 ? (
          /* Horizontal carousel — no vertical scroll, swipe left/right */
          <div className="snap-row px-4 pb-3 flex-shrink-0">
            {recentMatches.map((m, i) => (
              <MatchCard key={m.id || i} match={m} teamName={teamName} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Zap className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-gray-600 text-xs font-bold uppercase tracking-wider">
              Матчей пока нет
            </p>
            <p className="text-gray-700 text-[10px] mt-1">
              Жди следующего раунда лиги
            </p>
          </div>
        )}
      </div>

      {/* Bottom tab bar spacer */}
      <div className="h-16 flex-shrink-0" />
    </div>
  );
}
