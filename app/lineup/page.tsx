'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { PlayerTrainingModal } from '@/components/PlayerTrainingModal';
import { swapPlayers } from '@/app/actions/lineupActions';
import toast from 'react-hot-toast';

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
  is_nft_coach?: boolean;
  potential_limit: number;
  position: string;
  stats: PlayerStats;
  perks?: any;
  stamina: number;
  lineup_status: string;
  lineup_slot?: string;
}

interface Team {
  id: string;
  name: string;
  is_ready_for_match: boolean;
  formation?: string;
}

export default function LineupPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFormationLoading, setIsFormationLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [trainingPlayer, setTrainingPlayer] = useState<Player | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const router = useRouter();

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

  useEffect(() => {

    if (isAuthenticated && userId) {
      fetchTeamData();
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, isAuthLoading]);

  // Strict Redirect if no franchise
  useEffect(() => {
    if (!isLoading && !isAuthLoading && !team) {
      router.push('/');
    }
  }, [isLoading, isAuthLoading, team, router]);

  // Segment active players vs retired NFT coaches
  const activePlayers = players.filter(p => !p.is_nft_coach);
  const coaches = players.filter(p => p.is_nft_coach);
  
  const startingPlayers = activePlayers.filter(p => p.lineup_status === 'starting');
  const benchPlayers = activePlayers.filter(p => p.lineup_status === 'bench');

  // Categorize by position/slot
  const getSlotType = (p: Player) => p.lineup_slot ? p.lineup_slot.split('_')[0] : p.position;
  
  const fwds = startingPlayers.filter(p => getSlotType(p) === 'FWD');
  const mids = startingPlayers.filter(p => getSlotType(p) === 'MID');
  const defs = startingPlayers.filter(p => getSlotType(p) === 'DEF');
  const gks = startingPlayers.filter(p => getSlotType(p) === 'GK');

  const handlePlayerClick = async (player: Player) => {
    if (!selectedPlayerId) {
      setSelectedPlayerId(player.id);
      return;
    }

    if (selectedPlayerId === player.id) {
      setSelectedPlayerId(null);
      return;
    }

    const player1 = activePlayers.find(p => p.id === selectedPlayerId);
    const player2 = player;

    if (!player1 || !player2) {
      setSelectedPlayerId(null);
      return;
    }

    if (player1.lineup_status === player2.lineup_status) {
      setSelectedPlayerId(player.id);
      return;
    }

    setIsSwapping(true);
    setSubmitMessage(null);
    try {
      const res = await swapPlayers(player1.id, player2.id);

      if (res.success) {
        setPlayers(prev => prev.map(p => {
          if (p.id === player1.id) return { ...p, lineup_status: player2.lineup_status, lineup_slot: player2.lineup_slot };
          if (p.id === player2.id) return { ...p, lineup_status: player1.lineup_status, lineup_slot: player1.lineup_slot };
          return p;
        }));
      } else {
        toast.error(res.error || 'Swap failed');
        setSubmitMessage({ text: res.error || 'Swap failed', type: 'error' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during swap.');
      setSubmitMessage({ text: 'Network error during swap.', type: 'error' });
    } finally {
      setIsSwapping(false);
      setSelectedPlayerId(null);
    }
  };

  const handleFormationChange = async (newFormation: string) => {
    if (!userId || !team || team.formation === newFormation) return;
    
    setIsFormationLoading(true);
    setSubmitMessage(null);
    try {
      const res = await fetch('/api/lineup/formation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, formation: newFormation })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeam(prev => prev ? { ...prev, formation: newFormation } : prev);
        await fetchTeamData();
      } else {
        toast.error(data.error || 'Failed to change formation');
        setSubmitMessage({ text: data.error || 'Failed to change formation', type: 'error' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during formation change.');
      setSubmitMessage({ text: 'Network error during formation change.', type: 'error' });
    } finally {
      setIsFormationLoading(false);
    }
  };

  const isCompatible = (natural: string, slot: string) => {
    if (!slot) return true;
    if (natural === slot) return true;
    if (['LWF', 'RWF', 'ST', 'CF'].includes(natural) && slot === 'FWD') return true;
    if (['CAM', 'CDM', 'CM', 'RM', 'LM'].includes(natural) && slot === 'MID') return true;
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(natural) && slot === 'DEF') return true;
    return false;
  };

  const renderPlayerCard = (player: Player) => {
    const isSelected = selectedPlayerId === player.id;
    const slotPos = getSlotType(player);
    const isOOP = !isCompatible(player.position, slotPos) && player.lineup_status === 'starting';
    const displayOvr = isOOP ? Math.floor(player.ovr * 0.8) : player.ovr;

    return (
      <div 
        key={player.id} 
        onClick={() => handlePlayerClick(player)}
        className={`flex-1 max-w-[85px] mx-0.5 bg-black/80 backdrop-blur-md border rounded-md flex flex-col items-center shadow-lg overflow-hidden cursor-pointer transition-all relative ${
          isSelected 
            ? 'border-neon-pink shadow-[0_0_15px_rgba(255,0,60,0.6)] scale-105 z-10' 
            : isOOP
              ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.4)] hover:border-red-400'
              : 'border-neon-cyan/50 hover:border-white'
        }`}
      >
        {/* OOP Overlay */}
        {isOOP && (
          <div className="absolute inset-0 bg-red-900/20 animate-pulse pointer-events-none z-0"></div>
        )}

        {/* Train Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); setTrainingPlayer(player); }}
          className="absolute top-0 right-0 bg-neon-pink/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded-bl hover:bg-neon-pink z-20"
        >
          +
        </button>

        {/* Header */}
        <div className="w-full bg-gradient-to-b from-neon-cyan/30 to-transparent p-1 flex justify-between items-center border-b border-neon-cyan/20 relative z-10">
           <div className="flex items-center gap-1">
             <span className={`text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter shadow-[0_0_5px_rgba(0,240,255,0.8)] ${isOOP ? 'bg-red-500 text-white' : 'bg-neon-cyan text-black'}`}>
               {player.position}
             </span>
             {isOOP && <span className="text-[8px] text-red-500 animate-pulse">⚠️</span>}
           </div>
           <span className={`text-[11px] font-black drop-shadow-[0_0_2px_rgba(255,255,255,0.8)] pr-2 ${isOOP ? 'text-red-500' : 'text-white'}`}>{displayOvr}</span>
        </div>
        
        {/* Name */}
        <span className="text-[9px] font-bold text-white truncate w-full text-center py-0.5 px-1">{player.name.split(' ').pop()}</span>
        
        {/* Stamina & Stats Grid */}
        {player.stats && (
           <div className="w-full">
             <div className="bg-gray-800/80 text-[7px] text-center font-bold text-neon-green border-y border-gray-700 py-0.5">
               ⚡ {player.stamina}
             </div>
             <div className="grid grid-cols-2 gap-x-1 gap-y-0 p-1 bg-gray-900/80 text-[9px] font-orbitron text-gray-400">
               <div className="flex justify-between"><span>PAC</span><span className="text-neon-green font-bold">{player.stats.pace}</span></div>
               <div className="flex justify-between"><span>SHO</span><span className="text-neon-green font-bold">{player.stats.shooting}</span></div>
               <div className="flex justify-between"><span>PAS</span><span className="text-neon-green font-bold">{player.stats.passing}</span></div>
               <div className="flex justify-between"><span>DEF</span><span className="text-neon-green font-bold">{player.stats.defending}</span></div>
               <div className="col-span-2 flex justify-center gap-1 border-t border-gray-700 pt-[1px] mt-[1px]"><span>PHY</span><span className="text-neon-green font-bold">{player.stats.physical}</span></div>
             </div>
           </div>
        )}
      </div>
    );
  };
  
  // Calculate Average OVR exclusively for the starting pitch lineup
  let averageOvr = 50;
  if (startingPlayers.length > 0) {
    const sum = startingPlayers.reduce((acc, p) => {
       const slotPos = getSlotType(p);
       const oop = !isCompatible(p.position, slotPos) && p.lineup_status === 'starting';
       return acc + (oop ? Math.floor(p.ovr * 0.8) : p.ovr);
    }, 0);
    averageOvr = Math.max(1, Math.round(sum / startingPlayers.length));
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
        toast.success(json.message || 'Lineup submitted');
        setSubmitMessage({ text: json.message, type: 'success' });
        setTeam(prev => prev ? { ...prev, is_ready_for_match: true } : prev);
      } else {
        toast.error(json.error || 'Failed to submit lineup');
        setSubmitMessage({ text: json.error || 'Failed to submit lineup', type: 'error' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error connecting to backend servers.');
      setSubmitMessage({ text: 'Network error connecting to backend servers.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || isLoading || !team) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-space-dark">
        <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-12 bg-space-dark min-h-screen">
      {/* HEADER */}
      <header className="flex justify-between items-end border-b border-gray-800 pb-2">
        <div>
          <BackButton />
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
      <div className="flex justify-center gap-2 mb-[-10px] z-20">
        {['4-4-2', '4-3-3', '3-5-2'].map(f => (
          <button
            key={f}
            onClick={() => handleFormationChange(f)}
            disabled={isFormationLoading}
            className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors border ${
              team.formation === f || (!team.formation && f === '4-4-2')
                ? 'bg-neon-cyan text-black border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                : 'bg-black/50 text-gray-400 border-gray-700 hover:border-neon-cyan/50'
            } ${isFormationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className={`relative w-full aspect-[3/4] bg-green-950/30 border-2 border-neon-green/40 rounded-lg overflow-hidden shadow-[inset_0_0_40px_rgba(57,255,20,0.05)] flex flex-col items-center justify-around transition-opacity duration-300 ${isFormationLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`}>
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
          
          {startingPlayers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neon-cyan/60 font-mono">No starting players on roster</div>
          )}
        </div>
      </div>

      {/* BENCH / SUBSTITUTES */}
      {benchPlayers.length > 0 && (
        <div className="mt-2">
          <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">
            Substitutes Bench
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {benchPlayers.map(renderPlayerCard)}
          </div>
        </div>
      )}

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
          disabled={isSubmitting || isSwapping || startingPlayers.length === 0}
          className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition-all duration-300 ${
            isSubmitting || isSwapping || startingPlayers.length === 0
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-neon-cyan text-black hover:bg-white hover:text-neon-cyan shadow-[0_0_20px_rgba(0,240,255,0.4)]'
          }`}
        >
          {isSubmitting 
              ? 'Processing Transaction...' 
              : isSwapping
                ? 'Swapping...'
                : 'Submit Lineup'}
        </button>
      </div>

      {/* TRAINING MODAL */}
      {trainingPlayer && userId && (
        <PlayerTrainingModal 
          player={trainingPlayer} 
          userId={userId} 
          onClose={() => setTrainingPlayer(null)}
          onTrainSuccess={(updatedPlayer) => {
            setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p));
            setTrainingPlayer(updatedPlayer); // Update modal view instantly
          }}
        />
      )}
    </div>
  );
}
