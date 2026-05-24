import React from 'react';
import { supabase } from '@/lib/supabase';
import { NextOpponentCard } from '@/components/league/NextOpponentCard';
import { Calendar, History } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';

export default async function MatchCenterDashboard() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;

  if (!tgUserId) {
    redirect('/profile');
  }

  // Fetch all standings to pick a random opponent
  const { data: standingsData } = await supabase
    .from('league_standings')
    .select(`
      *,
      teams (
        id,
        name,
        user_id,
        logo_url
      )
    `);

  const standings = standingsData || [];
  const currentUserTeam = standings.find((s: any) => s.teams?.user_id === tgUserId)?.teams;

  // Next Opponent Logic
  let nextOpponent = null;
  let opponentPlayers: any[] = [];
  let avgOvr = 0;

  if (standings.length > 1) {
    const possibleOpponents = standings.filter((s: any) => s.teams?.id !== currentUserTeam?.id);
    if (possibleOpponents.length > 0) {
      const randIdx = Math.floor(Math.random() * possibleOpponents.length);
      nextOpponent = possibleOpponents[randIdx]?.teams;

      if (nextOpponent) {
        const { data: playersData } = await supabase
          .from('players')
          .select('name, position, ovr')
          .eq('team_id', nextOpponent.id)
          .eq('lineup_status', 'starting')
          .limit(11);

        if (playersData && playersData.length > 0) {
          opponentPlayers = playersData;
          const totalOvr = playersData.reduce((sum, p) => sum + p.ovr, 0);
          avgOvr = Math.round(totalOvr / playersData.length);
        }
      }
    }
  }

  // Fetch recent matches
  const { data: matchesData } = await supabase
    .from('matches')
    .select(`
      id, 
      home_score, 
      away_score, 
      match_date,
      home_team:teams!home_team_id (id, name),
      away_team:teams!away_team_id (id, name)
    `)
    .order('match_date', { ascending: false })
    .limit(20);

  const matches = matchesData || [];

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Calendar className="text-neon-green" /> 
          Match Center
        </h1>
        <p className="text-sm text-gray-400">Upcoming fixtures and recent global results.</p>
      </header>

      {/* Top Block: Upcoming Match */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)] flex items-center gap-2">
          Upcoming Match
        </h2>
        {nextOpponent ? (
          <NextOpponentCard 
            opponentTeamName={nextOpponent.name}
            opponentLogoUrl={nextOpponent.logo_url}
            averageOvr={avgOvr}
            starting11={opponentPlayers}
          />
        ) : (
          <div className="text-center p-8 bg-black/40 border border-dashed border-gray-800 rounded-xl text-sm text-gray-500">
            Waiting for league registration to complete...
          </div>
        )}
      </section>

      {/* Bottom Block: Recent Results */}
      <section className="flex flex-col gap-3 flex-1 min-h-[300px]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neon-pink drop-shadow-[0_0_5px_rgba(255,0,60,0.5)] flex items-center gap-2 mt-2">
          <History size={16} /> Recent Results
        </h2>
        <div className="flex flex-col gap-3">
          {matches.map(match => {
            const isHomeWin = match.home_score > match.away_score;
            const isAwayWin = match.away_score > match.home_score;
            const isDraw = match.home_score === match.away_score;
            
            return (
              <div key={match.id} className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-4 flex flex-col gap-2 shadow-[0_5px_15px_rgba(0,0,0,0.5)] hover:border-gray-700 transition-colors">
                <span className="text-[10px] text-gray-500 font-mono text-center uppercase tracking-widest">
                  {new Date(match.match_date).toLocaleString()}
                </span>
                <div className="flex justify-between items-center mt-2">
                  <div className={`flex-1 text-xs font-bold truncate text-right pr-4 ${(match.home_team as any)?.id === tgUserId ? 'text-neon-purple' : isHomeWin ? 'text-white' : isDraw ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(match.home_team as any)?.name || 'Unknown'}
                  </div>
                  <div className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg font-orbitron text-lg font-black text-white flex gap-3 shadow-inner">
                    <span className={isHomeWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : 'text-white'}>{match.home_score}</span>
                    <span className="text-gray-600">-</span>
                    <span className={isAwayWin ? 'text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : 'text-white'}>{match.away_score}</span>
                  </div>
                  <div className={`flex-1 text-xs font-bold truncate pl-4 ${(match.away_team as any)?.id === tgUserId ? 'text-neon-purple' : isAwayWin ? 'text-white' : isDraw ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(match.away_team as any)?.name || 'Unknown'}
                  </div>
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <div className="text-center p-8 bg-black/20 border border-dashed border-gray-800 rounded-xl text-sm text-gray-500">
              No matches have been played yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
