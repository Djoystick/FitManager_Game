'use client';

import { useState, useEffect } from 'react';
import { Trophy, Swords, Loader2, Medal, Crown, Plane, Building2, Shield, FileText, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { joinTournament } from '@/app/actions/tournamentActions';
import toast from 'react-hot-toast';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TournamentMatch {
  id: string;
  round: string;
  match_order: number;
  team_home: string | null;
  team_away: string | null;
  score_home: number | null;
  score_away: number | null;
  penalty_home: number | null;
  penalty_away: number | null;
  status: string;
  team_home_name: string;
  team_away_name: string;
}

interface TournamentClientProps {
  userId: string;
  teamId: string;
}

const ROUND_LABELS: Record<string, string> = {
  round_of_16: '1/8 FINAL',
  quarter_final: 'QUARTER-FINAL',
  semi_final: 'SEMI-FINAL',
  final: 'FINAL',
};

const ROUND_ORDER = ['round_of_16', 'quarter_final', 'semi_final', 'final'];

// ── Logistics Items ──────────────────────────────────────────────────────────
const LOGISTICS_ITEMS = [
  { icon: Plane, label: 'Перелёт команды', cost: 800, color: 'text-cyan-400' },
  { icon: Building2, label: 'Проживание (3 матча)', cost: 600, color: 'text-violet-400' },
  { icon: Shield, label: 'Страхование игроков', cost: 400, color: 'text-emerald-400' },
  { icon: FileText, label: 'Турнирная пошлина', cost: 700, color: 'text-amber-400' },
];

export function TournamentClient({ userId, teamId }: TournamentClientProps) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [packStep, setPackStep] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);

  useEffect(() => {
    loadBracket();
  }, []);

  const loadBracket = async () => {
    setLoading(true);
    try {
      // Get active tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['active', 'completed', 'registration'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!tournament) {
        setError('No active tournament');
        setLoading(false);
        return;
      }

      setActiveTournamentId(tournament.id);

      // Check if already joined
      if (tournament.status === 'registration') {
        const { data: existing } = await supabase
          .from('tournament_participants')
          .select('id')
          .eq('tournament_id', tournament.id)
          .eq('team_id', teamId)
          .maybeSingle();
        if (existing) setJoined(true);
      }

      // Get matches
      const { data: matchesData } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('match_order', { ascending: true });

      if (!matchesData) {
        setError('No matches found');
        setLoading(false);
        return;
      }

      // Get team names
      const teamIds = new Set<string>();
      matchesData.forEach(m => {
        if (m.team_home) teamIds.add(m.team_home);
        if (m.team_away) teamIds.add(m.team_away);
      });

      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', Array.from(teamIds));

      const teamNames: Record<string, string> = {};
      if (teamsData) {
        teamsData.forEach(t => { teamNames[t.id] = t.name; });
      }

      const enriched = matchesData.map(m => ({
        ...m,
        team_home_name: m.team_home ? teamNames[m.team_home] || 'TBD' : 'TBD',
        team_away_name: m.team_away ? teamNames[m.team_away] || 'TBD' : 'TBD',
      }));

      setMatches(enriched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Packing Animation ─────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!activeTournamentId || joining || joined) return;
    setJoining(true);
    setPackStep(0);

    // Animate through logistics items
    for (let i = 0; i < LOGISTICS_ITEMS.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setPackStep(i + 1);
    }

    // Final step
    await new Promise(r => setTimeout(r, 400));

    const result = await joinTournament(activeTournamentId);
    if (result.success) {
      setJoined(true);
      toast.success('Команда зарегистрирована! Удачи в турнире! 🏆');
      await loadBracket();
    } else {
      toast.error(result.error ?? 'Ошибка регистрации');
    }

    setPackStep(null);
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-violet-400" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
        <Trophy className="text-gray-600" size={36} />
        <h3 className="text-sm font-black font-orbitron text-gray-500 uppercase">No Tournament</h3>
        <p className="text-[10px] text-gray-600">{error}</p>
      </div>
    );
  }

  // Group matches by round
  const groupedMatches: Record<string, TournamentMatch[]> = {};
  ROUND_ORDER.forEach(round => {
    groupedMatches[round] = matches.filter(m => m.round === round);
  });

  const renderMatch = (match: TournamentMatch) => {
    const isHomeWinner = match.status === 'completed' && match.score_home !== null && match.score_away !== null && 
      (match.score_home > match.score_away || (match.penalty_home !== null && match.penalty_away !== null && match.penalty_home > match.penalty_away));
    const isAwayWinner = match.status === 'completed' && !isHomeWinner && match.score_home !== match.score_away;
    const isPenalties = match.penalty_home !== null && match.penalty_away !== null;

    return (
      <div
        key={match.id}
        className={`glass-card p-3 mb-2 ${
          match.team_home === teamId || match.team_away === teamId
            ? 'border border-violet-500/50'
            : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`flex-1 text-right ${isHomeWinner ? 'text-emerald-400' : 'text-gray-400'}`}>
            <span className="text-[11px] font-bold truncate">{match.team_home_name}</span>
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="text-sm font-black font-orbitron text-white">
              {match.status === 'completed' ? (
                `${match.score_home ?? 0} : ${match.score_away ?? 0}`
              ) : (
                <span className="text-gray-600">vs</span>
              )}
            </div>
            {isPenalties && (
              <div className="text-[8px] text-violet-400 font-mono">
                pen: {match.penalty_home} : {match.penalty_away}
              </div>
            )}
          </div>
          <div className={`flex-1 text-left ${isAwayWinner ? 'text-emerald-400' : 'text-gray-400'}`}>
            <span className="text-[11px] font-bold truncate">{match.team_away_name}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-3">
      <div className="flex items-center gap-2 mb-2">
        <Swords className="text-violet-400" size={20} />
        <h2 className="text-sm font-black font-orbitron text-white uppercase">Tournament Bracket</h2>
      </div>

      {/* ── E2: Cup Logistics Breakdown ────────────────────────────────────── */}
      {!joined && (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-black/40 to-orange-500/5 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-amber-500/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Trophy className="text-amber-400" size={12} />
              </div>
              <span className="text-[10px] font-black font-orbitron text-amber-400 uppercase tracking-widest">
                Логистика турнира
              </span>
            </div>
            <p className="text-[9px] text-gray-500 ml-8">Стоимость участия в Кубке Вызова</p>
          </div>

          {/* Items */}
          <div className="p-3 space-y-1.5">
            {LOGISTICS_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isAnimating = packStep !== null && packStep > idx;
              const isCurrentAnimating = packStep === idx;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-black/30 border border-gray-800/30"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isAnimating ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-gray-800/40 border border-gray-700/30'
                  }`}>
                    {isAnimating && !isCurrentAnimating ? (
                      <CheckCircle className="text-emerald-400" size={14} />
                    ) : isCurrentAnimating ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                        className="text-sm"
                      >⚙️</motion.span>
                    ) : (
                      <Icon className={item.color} size={14} />
                    )}
                  </div>
                  <span className={`flex-1 text-[10px] font-bold transition-colors duration-300 ${
                    isAnimating ? 'text-emerald-400' : 'text-gray-400'
                  }`}>
                    {item.label}
                  </span>
                  <span className={`text-[10px] font-mono font-bold transition-colors duration-300 ${
                    isAnimating ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {item.cost.toLocaleString()} FC
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Total */}
          <div className="p-3 border-t border-amber-500/10 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Итого</span>
            <span className="text-sm font-black font-orbitron text-amber-400">
              {LOGISTICS_ITEMS.reduce((s, i) => s + i.cost, 0).toLocaleString()} FC
            </span>
          </div>

          {/* Join Button */}
          <div className="p-3 pt-0">
            <button
              onClick={handleJoin}
              disabled={joining || joined}
              className={`w-full py-3 rounded-xl text-[11px] font-black font-orbitron uppercase tracking-wider
                         transition-all duration-300 border ${
                joined
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default'
                  : joining
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 cursor-wait'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black border-amber-400/50 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]'
              }`}
            >
              {joined ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={14} />
                  Зарегистрирован
                </span>
              ) : joining ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >✈️</motion.span>
                  {packStep !== null && packStep < LOGISTICS_ITEMS.length
                    ? 'Оформление...'
                    : packStep !== null
                      ? 'Регистрация...'
                      : 'Подготовка...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Swords size={14} />
                  Зарегистрироваться
                </span>
              )}
            </button>
          </div>

          {/* Tip */}
          <div className="px-3 pb-3">
            <p className="text-[8px] text-gray-600 text-center">
              💡 Улучши Трибуны для спонсорских бонусов, покрывающих расходы на турниры
            </p>
          </div>
        </div>
      )}

      {/* ── Bracket ────────────────────────────────────────────────────────── */}
      {ROUND_ORDER.map(round => {
        const roundMatches = groupedMatches[round];
        if (!roundMatches || roundMatches.length === 0) return null;

        return (
          <div key={round} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <h3 className="text-[10px] font-black font-orbitron text-violet-400 uppercase tracking-widest">
                {ROUND_LABELS[round]}
              </h3>
              <div className="flex-1 h-px bg-violet-500/20" />
            </div>

            {roundMatches.map(renderMatch)}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-1">
        <div className="flex items-center gap-1.5">
          <Medal className="text-yellow-400" size={10} />
          <span className="text-[8px] text-gray-600 uppercase">Winner advances</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Crown className="text-violet-400" size={10} />
          <span className="text-[8px] text-gray-600 uppercase">Final: 5000 FC + 5 TON</span>
        </div>
      </div>
    </div>
  );
}
