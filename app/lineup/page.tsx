'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/TelegramAuthProvider';
import Link from 'next/link';

interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

interface Player {
  id: string;
  name: string;
  age: number;
  ovr: number;
  is_nft_coach: boolean;
  position: string;
  stats: PlayerStats;
  perks: any;
}

interface Team {
  id: string;
  name: string;
  is_ready_for_match: boolean;
}

export default function LineupPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!userId) return;
      try {
        const res = await fetch(`/api/team/my-team?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setTeam(data.team);
            setPlayers(data.players);
          }
        }
      } catch (error) {
        console.error("Failed to fetch team data", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && userId) {
      fetchTeamData();
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  // Segment active players vs retired NFT coaches
  const activePlayers = players.filter(p => !p.is_nft_coach);
  const coaches = players.filter(p => p.is_nft_coach);
  
  // Categorize by position
  const fwds = activePlayers.filter(p => p.position === 'FWD');
  const mids = activePlayers.filter(p => p.position === 'MID');
  const defs = activePlayers.filter(p => p.position === 'DEF');
  const gks = activePlayers.filter(p => p.position === 'GK');

  const renderPlayerCard = (player: Player) => (
    <div key={player.id} className="flex-1 max-w-[85px] mx-0.5 bg-black/80 backdrop-blur-md border border-neon-cyan/50 rounded-md flex flex-col items-center shadow-[0_0_10px_rgba(0,240,255,0.15)] overflow-hidden">
      {/* Header */}
      <div className="w-full bg-gradient-to-b from-neon-cyan/30 to-transparent p-1 flex justify-between items-center border-b border-neon-cyan/20">
         <span className="text-[8px] font-black bg-neon-cyan text-black px-1 rounded-sm uppercase tracking-tighter shadow-[0_0_5px_rgba(0,240,255,0.8)]">{player.position}</span>
         <span className="text-[11px] font-black text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]">{player.ovr}</span>
      </div>
      
      {/* Name */}
      <span className="text-[9px] font-bold text-white truncate w-full text-center py-0.5 px-1">{player.name.split(' ').pop()}</span>
      
      {/* Stats Grid */}
      {player.stats && (
         <div className="grid grid-cols-2 gap-x-1 gap-y-0 w-full p-1 bg-gray-900/80 text-[7px] font-orbitron text-gray-400">
           <div className="flex justify-between"><span>PAC</span><span className="text-neon-green font-bold">{player.stats.pace}</span></div>
           <div className="flex justify-between"><span>SHO</span><span className="text-neon-green font-bold">{player.stats.shooting}</span></div>
           <div className="flex justify-between"><span>PAS</span><span className="text-neon-green font-bold">{player.stats.passing}</span></div>
           <div className="flex justify-between"><span>DEF</span><span className="text-neon-green font-bold">{player.stats.defending}</span></div>
           <div className="col-span-2 flex justify-center gap-1 border-t border-gray-700 pt-[1px] mt-[1px]"><span>PHY</span><span className="text-neon-green font-bold">{player.stats.physical}</span></div>
         </div>
      )}
    </div>
  );
  
  // Calculate Average OVR exclusively for the active pitch lineup
  let averageOvr = 50;
  if (activePlayers.length > 0) {
    const sum = activePlayers.reduce((acc, p) => acc + p.ovr, 0);
    averageOvr = Math.round(sum / activePlayers.length);
  }

  // Calculate projected Luxury Tax
  const LEAGUE_OVR_CAP = 80;
  const TAX_RATE_PER_OVR = 50;
  const expectedTax = Math.max(0, (averageOvr - LEAGUE_OVR_CAP) * TAX_RATE_PER_OVR);

  const handleSubmitLineup = async () => {
    if (!userId || !team) return;
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/team/submit-lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, teamId: team.id }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitMessage({ text: json.message, type: 'success' });
        setTeam(prev => prev ? { ...prev, is_ready_for_match: true } : prev);
      } else {
        setSubmitMessage({ text: json.error || 'Failed to submit lineup', type: 'error' });
      }
    } catch (err) {
      setSubmitMessage({ text: 'Network error connecting to backend servers.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 bg-space-dark">
        <p className="text-neon-pink text-xl font-bold">No Franchise Detected</p>
        <p className="text-gray-400 text-sm">You need to establish a team before managing a tactical lineup.</p>
        <Link href="/" className="px-5 py-3 bg-neon-cyan text-black font-black rounded mt-4 hover:bg-white transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-12 bg-space-dark min-h-screen">
      {/* HEADER */}
      <header className="flex justify-between items-end border-b border-gray-800 pb-2">
        <div>
          <Link href="/" className="text-xs text-neon-cyan hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Tactics</h1>
          <p className="text-xs text-gray-400 font-mono tracking-widest">{team.name}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Squad Power</div>
          <div className="text-3xl font-black text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">{averageOvr}</div>
        </div>
      </header>

      {/* LUXURY TAX HUD */}
      <div className={`p-4 rounded-xl border flex items-center justify-between shadow-lg transition-colors duration-500 ${
        expectedTax > 0 
          ? 'bg-red-900/10 border-neon-pink shadow-[0_0_15px_rgba(255,0,60,0.2)]' 
          : 'bg-green-900/10 border-neon-green/30'
      }`}>
        <div>
          <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Luxury Tax Status</h3>
          <p className="text-xs text-gray-400">Soft Cap: {LEAGUE_OVR_CAP} OVR</p>
        </div>
        <div className="text-right">
          {expectedTax > 0 ? (
            <span className="text-lg font-black text-neon-pink drop-shadow-[0_0_8px_rgba(255,0,60,0.8)] animate-pulse">
              -{expectedTax} FC
            </span>
          ) : (
            <span className="text-sm font-bold text-neon-green tracking-widest uppercase">Tax Exempt</span>
          )}
        </div>
      </div>

      {/* TACTICAL PITCH UI */}
      <div className="relative w-full aspect-[3/4] bg-green-950/30 border-2 border-neon-green/40 rounded-lg overflow-hidden shadow-[inset_0_0_40px_rgba(57,255,20,0.05)] flex flex-col items-center justify-around">
        {/* Abstract Pitch Markings */}
        <div className="absolute top-0 w-1/2 h-16 border-2 border-t-0 border-neon-green/20 rounded-b-md"></div>
        <div className="absolute bottom-0 w-1/2 h-16 border-2 border-b-0 border-neon-green/20 rounded-t-md"></div>
        <div className="absolute top-1/2 left-0 w-full border-t-2 border-neon-green/20"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-neon-green/20 rounded-full"></div>

        {/* Player Mapping (Tactical Layout) */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between px-2 py-4">
          
          {/* FWD Line */}
          <div className="w-full flex justify-around items-center">
             {fwds.map(renderPlayerCard)}
          </div>
          
          {/* MID Line */}
          <div className="w-full flex justify-around items-center">
             {mids.map(renderPlayerCard)}
          </div>
          
          {/* DEF Line */}
          <div className="w-full flex justify-around items-center">
             {defs.map(renderPlayerCard)}
          </div>
          
          {/* GK Line */}
          <div className="w-full flex justify-around items-center">
             {gks.map(renderPlayerCard)}
          </div>
          
          {activePlayers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neon-cyan/60 font-mono">No active players on roster</div>
          )}
        </div>
      </div>

      {/* STAFF / EVOLVED COACHES */}
      {coaches.length > 0 && (
        <div className="mt-2">
          <h3 className="text-xs font-bold text-neon-pink mb-2 uppercase tracking-widest border-b border-gray-800 pb-1 flex items-center justify-between">
            <span>Staff Roster</span>
            <span className="text-[10px] text-gray-500">Passive Boosts Active</span>
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {coaches.map(coach => (
              <div key={coach.id} className="min-w-[110px] bg-black/40 border border-neon-pink/30 p-2 rounded-lg flex flex-col items-center flex-shrink-0 shadow-[0_0_10px_rgba(255,0,60,0.1)]">
                <span className="text-[10px] font-black text-neon-pink uppercase tracking-widest mb-1">NFT Coach</span>
                <span className="text-xs font-bold text-white truncate w-full text-center">{coach.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBMISSION AREA */}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        {submitMessage && (
          <div className={`p-3 rounded text-sm text-center border font-semibold ${submitMessage.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-green-900/20 text-neon-green border-neon-green/40 shadow-[0_0_10px_rgba(57,255,20,0.2)]'}`}>
            {submitMessage.text}
          </div>
        )}

        <button 
          onClick={handleSubmitLineup}
          disabled={isSubmitting || team.is_ready_for_match || activePlayers.length === 0}
          className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition-all duration-300 ${
            team.is_ready_for_match
              ? 'bg-neon-green text-black cursor-not-allowed shadow-[0_0_20px_rgba(57,255,20,0.4)] opacity-90'
              : isSubmitting || activePlayers.length === 0
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-neon-cyan text-black hover:bg-white hover:text-neon-cyan shadow-[0_0_20px_rgba(0,240,255,0.4)]'
          }`}
        >
          {team.is_ready_for_match 
            ? 'Match Ready / Locked' 
            : isSubmitting 
              ? 'Processing Transaction...' 
              : 'Submit Lineup'}
        </button>
      </div>
    </div>
  );
}
