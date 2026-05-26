'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';
import { PlayerTrainingModal } from '@/components/PlayerTrainingModal';
import { swapPlayers } from '@/app/actions/lineupActions';
import { healAllPlayersStamina } from '@/app/actions/playerActions';
import toast from 'react-hot-toast';
import { Shirt, Dumbbell, CircleHelp, X } from 'lucide-react';

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
  is_injured?: boolean;
  injury_matches_left?: number;
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
  const [isHealingAll, setIsHealingAll] = useState(false);
  const [trainingPlayer, setTrainingPlayer] = useState<Player | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  
  // New State for Tabs
  const [activeTab, setActiveTab] = useState<'pitch' | 'roster'>('pitch');
  
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
    // Only allow swapping in pitch view
    if (activeTab !== 'pitch') return;

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

    setIsSwapping(true);
    setSubmitMessage(null);
    try {
      const res = await swapPlayers(player1.id, player2.id);

      if (res.success) {
        setPlayers(prev => {
          const newPlayers = prev.map(p => ({ ...p })); // Deep copy
          const p1 = newPlayers.find(p => p.id === player1.id);
          const p2 = newPlayers.find(p => p.id === player2.id);
          
          if (p1 && p2) {
            const tempSlot = p1.lineup_slot;
            const tempStatus = p1.lineup_status;
            
            p1.lineup_slot = p2.lineup_slot || null;
            p1.lineup_status = p2.lineup_status;
            
            p2.lineup_slot = tempSlot || null;
            p2.lineup_status = tempStatus;
          }
          return newPlayers;
        });
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

  const handleMassHeal = async () => {
    if (!userId) return;
    setIsHealingAll(true);
    setSubmitMessage(null);
    try {
      const res = await healAllPlayersStamina(userId);
      if (res.success) {
        toast.success(`Healed ${res.playersHealed} players`);
        setSubmitMessage({ text: `Healed ${res.playersHealed} players!`, type: 'success' });
        setPlayers(prev => prev.map(p => ({ ...p, stamina: 100 })));
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(res.error || 'Failed to mass heal');
        setSubmitMessage({ text: res.error || 'Failed to mass heal', type: 'error' });
      }
    } catch (err: any) {
      toast.error('Network error during mass heal');
      setSubmitMessage({ text: 'Network error during mass heal', type: 'error' });
    } finally {
      setIsHealingAll(false);
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

  // Compact Marker for Pitch View
  const renderPitchMarker = (player: Player) => {
    const isSelected = selectedPlayerId === player.id;
    const slotPos = getSlotType(player);
    const isOOP = !isCompatible(player.position, slotPos) && player.lineup_status === 'starting';
    const displayOvr = isOOP ? Math.floor(player.ovr * 0.8) : player.ovr;

    return (
      <div 
        key={player.id} 
        onClick={() => handlePlayerClick(player)}
        className={`relative flex flex-col items-center justify-center p-1 w-14 cursor-pointer transition-all rounded-md ${
          isSelected 
            ? 'ring-2 ring-neon-pink scale-110 z-20 bg-neon-pink/20 shadow-[0_0_15px_rgba(255,0,60,0.6)]' 
            : isOOP
              ? 'ring-1 ring-red-500 bg-red-900/40 hover:bg-red-900/60 shadow-[0_0_10px_rgba(255,0,0,0.4)]'
              : 'hover:bg-white/10'
        }`}
      >
        {/* Position Badge & Injury */}
        <div className="flex gap-0.5 items-center mb-0.5 z-10">
          <span className={`text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter shadow-sm ${isOOP ? 'bg-red-500 text-white' : 'bg-neon-cyan text-black'}`}>
            {player.position}
          </span>
          {player.is_injured && <span className="text-[8px] drop-shadow-[0_0_2px_rgba(255,0,0,0.8)]">🚑</span>}
        </div>

        {/* Shirt Icon / OVR */}
        <div className="relative flex items-center justify-center">
          <Shirt className={`w-9 h-9 drop-shadow-md ${isOOP ? 'text-red-500' : 'text-white'}`} fill={isOOP ? '#ef4444' : '#ffffff'} fillOpacity={0.2} strokeWidth={1.5} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-1">
            <span className={`text-[11px] font-black drop-shadow-md ${isOOP ? 'text-red-500' : 'text-neon-cyan'}`}>{displayOvr}</span>
          </div>
        </div>

        {/* Name */}
        <span className="text-[10px] font-bold text-white truncate w-full text-center tracking-wider mt-0.5 drop-shadow-sm leading-tight">
          {player.name.split(' ').pop()}
        </span>
        
        {/* Stamina Bar */}
        <div className="w-10 h-1 mt-1 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
          <div className={`h-full ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${player.stamina}%` }}></div>
        </div>
      </div>
    );
  };

  // Detailed Row for List View
  const renderListRow = (player: Player) => {
    const slotPos = getSlotType(player);
    const isOOP = !isCompatible(player.position, slotPos) && player.lineup_status === 'starting';
    const displayOvr = isOOP ? Math.floor(player.ovr * 0.8) : player.ovr;

    return (
      <div key={player.id} className="flex flex-col py-1.5 px-3 mb-2 bg-black/60 border border-gray-800 rounded-lg shadow-sm hover:border-gray-600 transition-colors backdrop-blur-sm w-full">
        
        {/* Top Tier */}
        <div className="flex justify-between items-center w-full">
          {/* Left: Badge + Name */}
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm flex-shrink-0 ${isOOP ? 'bg-red-500 text-white' : 'bg-neon-cyan text-black'}`}>
              {player.position}
            </span>
            <span className="text-sm font-bold text-white truncate">{player.name}</span>
            {isOOP && <span className="text-[8px] text-red-500 font-bold animate-pulse flex-shrink-0">⚠️ OOP</span>}
          </div>

          {/* Right: OVR + Train Button */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            <div className={`text-lg font-black ${isOOP ? 'text-red-500' : 'text-white'} drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] leading-none`}>
              {displayOvr}
            </div>
            <button
              onClick={() => setTrainingPlayer(player)}
              className="bg-neon-pink/10 hover:bg-neon-pink text-neon-pink hover:text-white border border-neon-pink/40 text-[10px] font-bold p-1.5 rounded transition-all shadow-[0_0_10px_rgba(255,0,60,0.1)] hover:shadow-[0_0_15px_rgba(255,0,60,0.4)]"
            >
              <Dumbbell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Tier */}
        <div className="flex justify-between items-end w-full mt-1.5">
          {/* Left: Stamina + Injury */}
          <div className="flex flex-col w-24 gap-1 flex-shrink-0">
             <div className="flex justify-between items-center">
               <span className={`text-[10px] font-mono font-bold leading-none ${player.stamina > 70 ? 'text-neon-green' : player.stamina > 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                 ⚡ {player.stamina}
               </span>
               {player.is_injured && <span className="text-[8px] bg-red-900/50 text-red-300 px-1 rounded-sm leading-none py-0.5">🚑 {player.injury_matches_left}M</span>}
             </div>
             {/* Stamina bar visual */}
             <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                <div className={`h-full ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${player.stamina}%` }}></div>
             </div>
          </div>

          {/* Right: Stats row */}
          {player.stats && (
            <div className="flex items-center gap-2.5 flex-wrap justify-end pl-2">
              <div className="flex items-baseline gap-1"><span className="text-gray-400 text-[10px]">PAC</span><span className="text-white font-mono text-[11px]">{player.stats.pace}</span></div>
              <div className="flex items-baseline gap-1"><span className="text-gray-400 text-[10px]">SHO</span><span className="text-white font-mono text-[11px]">{player.stats.shooting}</span></div>
              <div className="flex items-baseline gap-1"><span className="text-gray-400 text-[10px]">PAS</span><span className="text-white font-mono text-[11px]">{player.stats.passing}</span></div>
              <div className="flex items-baseline gap-1"><span className="text-gray-400 text-[10px]">DEF</span><span className="text-white font-mono text-[11px]">{player.stats.defending}</span></div>
              <div className="flex items-baseline gap-1"><span className="text-gray-400 text-[10px]">PHY</span><span className="text-white font-mono text-[11px]">{player.stats.physical}</span></div>
            </div>
          )}
        </div>

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
    <div className="flex flex-col flex-1 p-4 gap-4 pb-12 bg-space-dark min-h-screen">
      {/* HEADER */}
      <header className="flex justify-between items-end border-b border-gray-800 pb-2">
        <div>
          <BackButton />
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Squad</h1>
          <p className="text-xs text-gray-400 font-mono tracking-widest">{team.name}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Squad Power</div>
          <div className="text-3xl font-black text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">{averageOvr}</div>
        </div>
      </header>

      {/* LUXURY TAX HUD */}
      <div className={`p-3 rounded-xl border flex items-center justify-between shadow-lg transition-colors duration-500 ${
        expectedTax > 0 
          ? 'bg-red-900/10 border-neon-pink shadow-[0_0_15px_rgba(255,0,60,0.2)]' 
          : 'bg-green-900/10 border-neon-green/30'
      }`}>
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Luxury Tax Status</h3>
          <p className="text-[10px] text-gray-400">Soft Cap: {LEAGUE_OVR_CAP} OVR</p>
        </div>
        <div className="text-right">
          {expectedTax > 0 ? (
            <span className="text-base font-black text-neon-pink drop-shadow-[0_0_8px_rgba(255,0,60,0.8)] animate-pulse">
              -{expectedTax} FC
            </span>
          ) : (
            <span className="text-xs font-bold text-neon-green tracking-widest uppercase">Tax Exempt</span>
          )}
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex bg-black/50 p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-md transition-all ${
            activeTab === 'pitch'
              ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Тактика (Pitch)
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-md transition-all ${
            activeTab === 'roster'
              ? 'bg-neon-pink text-white shadow-[0_0_10px_rgba(255,0,60,0.4)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Тренировка (Roster)
        </button>
      </div>

      {/* CONDITIONAL RENDER: PITCH VIEW */}
      {activeTab === 'pitch' && (
        <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
          {/* TACTICAL PITCH UI */}
          <div className="flex justify-center gap-2 mb-[-10px] z-20">
            {['4-4-2', '4-3-3', '3-5-2'].map(f => {
              const realFormation = `${defs.length}-${mids.length}-${fwds.length}`;
              const isRealActive = realFormation === f;
              return (
                <button
                  key={f}
                  onClick={() => handleFormationChange(f)}
                  disabled={isFormationLoading}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors border ${
                    isRealActive
                      ? 'bg-neon-cyan text-black border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                      : 'bg-black/50 text-gray-400 border-gray-700 hover:border-neon-cyan/50'
                  } ${isFormationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {f}
                </button>
              );
            })}
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
              <div className="w-full flex justify-around items-center h-[20%]">
                 {fwds.map(renderPitchMarker)}
              </div>
              
              {/* MID Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {mids.map(renderPitchMarker)}
              </div>
              
              {/* DEF Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {defs.map(renderPitchMarker)}
              </div>
              
              {/* GK Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {gks.map(renderPitchMarker)}
              </div>
              
              {startingPlayers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-neon-cyan/60 font-mono">No starting players on roster</div>
              )}
            </div>
          </div>

          {/* BENCH / SUBSTITUTES (PITCH VIEW) */}
          {benchPlayers.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">
                Substitutes Bench
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {benchPlayers.map(renderPitchMarker)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONDITIONAL RENDER: LIST VIEW (ROSTER / TRAINING) */}
      {activeTab === 'roster' && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
          
          {/* STARTING XI BLOCK */}
          <div>
            <h3 className="text-sm font-black text-neon-cyan mb-3 uppercase tracking-widest border-b border-neon-cyan/30 pb-1 flex items-center justify-between">
              <span>Starting XI</span>
              <button 
                onClick={() => setIsStatsModalOpen(true)}
                className="text-neon-cyan/70 hover:text-white transition-colors p-1"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
            </h3>
            <div className="flex flex-col">
              {startingPlayers.length > 0 ? (
                startingPlayers.map(renderListRow)
              ) : (
                <div className="text-center text-gray-500 py-4 text-xs font-mono">No starting players.</div>
              )}
            </div>
          </div>

          {/* BENCH BLOCK */}
          <div>
            <h3 className="text-sm font-black text-white mb-3 uppercase tracking-widest border-b border-gray-700 pb-1 mt-2">
              Bench / Reserves
            </h3>
            <div className="flex flex-col">
              {benchPlayers.length > 0 ? (
                benchPlayers.map(renderListRow)
              ) : (
                <div className="text-center text-gray-500 py-4 text-xs font-mono">No bench players.</div>
              )}
            </div>
          </div>
          
          {/* STAFF / EVOLVED COACHES (Shown only in Roster view ideally, or both. Let's show here) */}
          {coaches.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-bold text-neon-pink mb-2 uppercase tracking-widest border-b border-neon-pink/30 pb-1 flex items-center justify-between">
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
        </div>
      )}

      {/* SUBMISSION & ACTIONS AREA (GLOBAL) */}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        
        {/* Mass Heal Button */}
        {players.filter(p => p.stamina < 100).length > 0 && (
          <button 
            onClick={handleMassHeal}
            disabled={isHealingAll || isSubmitting || isSwapping}
            className={`w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider flex justify-between items-center px-4 transition-all ${
              isHealingAll || isSubmitting || isSwapping
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500 hover:text-black shadow-[0_0_10px_rgba(234,179,8,0.2)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span>Mass Heal Roster</span>
            </div>
            <span className="font-mono">-{players.filter(p => p.stamina < 100).length * 50} TP</span>
          </button>
        )}

        {submitMessage && (
          <div className={`p-3 rounded text-sm text-center border font-semibold ${submitMessage.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-green-900/20 text-neon-green border-neon-green/40 shadow-[0_0_10px_rgba(57,255,20,0.2)]'}`}>
            {submitMessage.text}
          </div>
        )}

        {/* Submit Lineup Button (Only makes sense if starting players > 0 and maybe mostly for pitch, but keeping global) */}
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

      {/* STATS INFO MODAL */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border-2 border-neon-cyan/50 rounded-xl w-full max-w-sm overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.15)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50">
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <CircleHelp className="w-5 h-5 text-neon-cyan" />
                Player Stats
              </h2>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4 text-sm bg-gray-900/90">
              <div>
                <span className="font-mono font-bold text-neon-cyan">PAC (Pace):</span>
                <span className="text-gray-300 ml-2">Скорость игрока. Влияет на успешность отрывов и перемещение по полю.</span>
              </div>
              <div>
                <span className="font-mono font-bold text-neon-cyan">SHO (Shooting):</span>
                <span className="text-gray-300 ml-2">Удары. Определяет шанс забить гол при создании голевого момента.</span>
              </div>
              <div>
                <span className="font-mono font-bold text-neon-cyan">PAS (Passing):</span>
                <span className="text-gray-300 ml-2">Пасы. Влияет на контроль мяча (Владение) в центре поля и создание моментов.</span>
              </div>
              <div>
                <span className="font-mono font-bold text-neon-cyan">DEF (Defending):</span>
                <span className="text-gray-300 ml-2">Защита. Шанс отобрать мяч и прервать атаку соперника.</span>
              </div>
              <div>
                <span className="font-mono font-bold text-neon-cyan">PHY (Physical):</span>
                <span className="text-gray-300 ml-2">Физика. Влияет на борьбу за мяч и выносливость в стыках.</span>
              </div>
            </div>
            
            <div className="p-4 bg-black/50 border-t border-gray-800">
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="w-full py-3 rounded-lg font-black uppercase tracking-widest bg-gray-800 text-white hover:bg-gray-700 transition-colors border border-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
