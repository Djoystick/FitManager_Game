'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Users, Activity, ShoppingCart, Shield, Trophy } from 'lucide-react';
import { UnseenMatchesModal } from '@/components/UnseenMatchesModal';
import { MatchHistoryWidget } from '@/components/MatchHistoryWidget';
import { NextMatchCountdown } from '@/components/dashboard/NextMatchCountdown';

export default function DashboardPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [unseenMatches, setUnseenMatches] = useState<any[]>([]);
  const [leagueTier, setLeagueTier] = useState<number | null>(null);
  const [lobbyTimeLeft, setLobbyTimeLeft] = useState<number | null>(null);
  const [lobbyTeamCount, setLobbyTeamCount] = useState<number>(1);

  const fetchUserData = async (id: string) => {
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
            const createdTime = new Date(teamJson.instanceCreatedAt).getTime();
            const now = new Date().getTime();
            const diff = 60000 - (now - createdTime); // 60 seconds
            if (diff > 0) {
              setLobbyTimeLeft(Math.floor(diff / 1000));
            } else {
              setLobbyTimeLeft(0);
              fetch('/api/cron/league-autofill').then(() => {
                window.location.reload();
              });
            }
          }

          import('@/app/actions/matchActions').then(mod => {
            mod.getUnseenMatches(teamJson.team.id).then(res => {
              if (res.success && res.matches) {
                setUnseenMatches(res.matches);
              }
            });
          });
        }
      } else {
        setHasTeam(true);
      }

      if (leagueRes.ok) {
        const lJson = await leagueRes.json();
        if (lJson.league_instance?.tier_level) {
          setLeagueTier(lJson.league_instance.tier_level);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      setHasTeam(true);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchUserData(userId);
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsDataLoading(false); 
      setHasTeam(true); 
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  useEffect(() => {
    if (lobbyTimeLeft !== null && lobbyTimeLeft > 0) {
      const timer = setInterval(() => {
        setLobbyTimeLeft(prev => {
          if (prev && prev <= 1) {
            clearInterval(timer);
            fetch('/api/cron/league-autofill').then(() => {
              window.location.reload();
            });
            return 0;
          }
          return prev ? prev - 1 : 0;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lobbyTimeLeft]);

  if (isAuthLoading || isDataLoading || hasTeam === null) {
    return <CyberLoader fullScreen text={t.loading} />;
  }

  if (hasTeam === false && userId) {
    if (typeof window !== 'undefined') {
      window.location.href = '/onboarding';
    }
    return <CyberLoader fullScreen text={t.loading} />;
  }

  const teamOvr = players.length ? Math.round(players.reduce((sum, p) => sum + (p.ovr || 0), 0) / players.length) : 0;
  const avgStamina = players.length ? Math.round(players.reduce((sum, p) => sum + (p.stamina || 0), 0) / players.length) : 0;

  const handleAcknowledgeUnseen = async (matchIds: string[]) => {
    setUnseenMatches([]);
    if (teamId) {
      const mod = await import('@/app/actions/matchActions');
      await mod.markMatchesAsViewed(matchIds, teamId);
    }
  };

  return (
    <div className="flex flex-col flex-1 relative bg-[#060913] text-white overflow-y-auto overflow-x-hidden min-h-screen p-4 pb-24">
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none opacity-20"
           style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.2) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neon-cyan/5 via-transparent to-transparent opacity-50 blur-3xl"></div>
      
      {/* SCANLINE */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 z-0"></div>

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-4 mt-2">
        <UnseenMatchesModal matches={unseenMatches} onAcknowledge={handleAcknowledgeUnseen} />

        {lobbyTimeLeft !== null && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-32 h-32 rounded-full border-4 border-neon-cyan/40 mb-6 flex items-center justify-center bg-black/60 shadow-[0_0_40px_rgba(0,240,255,0.4)] animate-pulse">
              <span className="text-5xl text-neon-cyan font-orbitron font-black">{lobbyTimeLeft}s</span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-widest font-orbitron mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              WAITING FOR TEAMS
            </h2>
            <p className="text-neon-cyan text-2xl font-bold mb-8 font-orbitron tracking-widest">
              {lobbyTeamCount} / 14
            </p>
            <div className="bg-gray-900 border border-neon-cyan/30 p-6 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.1)] max-w-sm">
              <p className="text-gray-300 text-sm font-inter">
                The league will automatically fill with remaining bots and start when the timer reaches zero.
              </p>
            </div>
          </div>
        )}

        {/* HOLO DISPLAY (FRANCHISE STATUS) */}
        <div className="bg-black/40 backdrop-blur-xl border border-neon-cyan/30 rounded-3xl p-4 shadow-[0_0_30px_rgba(0,240,255,0.15)] relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"></div>
          
          {/* PROFILE / SETTINGS BUTTON */}
          <Link href="/profile" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-900 border border-neon-cyan/40 flex items-center justify-center hover:bg-neon-cyan/20 transition-colors z-20 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
            <span className="text-gray-300 text-sm font-bold">⚙️</span>
          </Link>
          
          <h2 className="text-[10px] font-bold text-neon-cyan uppercase tracking-[0.3em] mb-2 drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">
            {t.franchise_status}
          </h2>

          <div className="w-16 h-16 bg-gray-900 border-2 border-neon-cyan/50 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] overflow-hidden">
            {teamLogoUrl ? (
              <img src={teamLogoUrl} alt={teamName || 'Team'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black font-orbitron text-white">
                {teamName ? teamName.substring(0,2).toUpperCase() : 'FC'}
              </span>
            )}
          </div>

          <h1 className="text-xl font-black uppercase font-orbitron text-white drop-shadow-md mb-3 text-center">
            {teamName}
          </h1>

          {/* STATS PROGRESS BARS */}
          <div className="w-full flex flex-col gap-4">
            {/* OVR */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{t.team_ovr}</span>
                <span className="text-sm font-black text-neon-cyan font-orbitron">{teamOvr}</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <div className="h-full bg-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.8)] transition-all duration-1000" style={{ width: `${Math.min(100, teamOvr)}%` }}></div>
              </div>
            </div>

            {/* Stamina */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{t.avg_stamina}</span>
                <span className="text-sm font-black text-green-400 font-orbitron">{avgStamina}%</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] transition-all duration-1000" style={{ width: `${avgStamina}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <NextMatchCountdown language={language} />

        {/* LEAGUE STATUS */}
        <div className="bg-purple-900/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden group">
          <div className="absolute -left-10 w-20 h-full bg-purple-500/20 blur-2xl transform -skew-x-12 group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/50">
              <Trophy className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
            </div>
            <span className="font-orbitron font-bold text-sm tracking-widest text-purple-100">
              {leagueTier ? t.active_league.replace('{tier}', leagueTier.toString()) : t.loading}
            </span>
          </div>
        </div>

        {/* QUICK TERMINALS */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 ml-2">
            {t.quick_actions}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/squad" className="bg-black/60 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-blue-900/20 hover:border-blue-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300">
              <Users className="w-6 h-6 text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-100">{t.dashboard_squad}</span>
            </Link>

            <Link href="/training" className="bg-black/60 backdrop-blur-md border border-emerald-500/30 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-emerald-900/20 hover:border-emerald-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300">
              <Activity className="w-6 h-6 text-emerald-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-100">{t.dashboard_training}</span>
            </Link>

            <Link href="/market" className="bg-black/60 backdrop-blur-md border border-amber-500/30 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-amber-900/20 hover:border-amber-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all duration-300">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-100">{t.dashboard_market}</span>
            </Link>
          </div>
        </div>

        {/* MATCH JOURNAL */}
        <section className="mt-2 mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 ml-2">
            {t.match_journal}
          </h3>
          {userId && <MatchHistoryWidget userId={userId} teamName={teamName} language={language} />}
        </section>

      </div>
    </div>
  );
}
