'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useRouter } from 'next/navigation';
import { swapPlayers, updatePlayers, updateTeamFormation } from '@/app/actions/lineupActions';
import { healAllPlayers } from '@/app/actions/baseActions';
import toast from 'react-hot-toast';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Shirt, X, RefreshCw, User, Eye, EyeOff, Zap, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerProfileModal } from '@/components/PlayerProfileModal';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ChemistryOverlay } from '@/components/ChemistryOverlay';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { ScreenGuide } from '@/components/ui/ScreenGuide';

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
  traits?: string[];
}

interface Team {
  id: string;
  name: string;
  is_ready_for_match: boolean;
  formation?: string;
}

export default function LineupPage() {
  const { userId, isAuthenticated, isLoading: isAuthLoading } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFormationLoading, setIsFormationLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isHealingAll, setIsHealingAll] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [viewMode, setViewMode] = useState<'lineup' | 'scout'>('lineup');
  const [scoutReport, setScoutReport] = useState<any>(null);
  const [isLoadingScout, setIsLoadingScout] = useState(false);
  const [activeFormation, setActiveFormation] = useState('4-4-2');
  const [hasCheckedCorruption, setHasCheckedCorruption] = useState(false);
  const [activeHUD, setActiveHUD] = useState<{player: Player, x: number, y: number, isBelow?: boolean} | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [showChemistry, setShowChemistry] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  
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
          setActiveFormation(data.team?.formation || '4-4-2');
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

  // Segment active players
  const activePlayers = players.filter(p => !p.is_nft_coach);
  
  // Data Corruption Check
  const isCorrupted = activePlayers.some(p => {
    if (p.lineup_status === 'starting' || p.lineup_status === 'bench') {
      if (!p.lineup_slot) return true;
      const idx = parseInt(p.lineup_slot, 10);
      if (isNaN(idx) || idx < 0 || idx > 15) return true;
    }
    return false;
  });

  const handleEmergencyReset = async () => {
    setIsSubmitting(true);
    try {
      const sortedPlayers = [...activePlayers].sort((a, b) => b.ovr - a.ovr);
      const payload = sortedPlayers.map((p, index) => {
        let newStatus = 'reserve';
        let newSlot: string | null = null;
        if (index < 11) {
          newStatus = 'starting';
          newSlot = index.toString();
        } else if (index >= 11 && index < 16) {
          newStatus = 'bench';
          newSlot = index.toString();
        }
        return {
          id: p.id,
          lineup_status: newStatus,
          lineup_slot: newSlot
        };
      });
      
      const res = await updatePlayers(payload);
      if (res.success) {
        toast.success('Database recovered. Reloading...');
        window.location.reload();
      } else {
        toast.error(res.error || 'Failed to hard reset');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      toast.error('Network error during hard reset');
      setIsSubmitting(false);
    }
  };

  const FORMATIONS = {
    '4-4-2': { FWD: [9, 10], MID: [5, 6, 7, 8], DEF: [1, 2, 3, 4], GK: [0] },
    '4-3-3': { FWD: [8, 9, 10], MID: [5, 6, 7], DEF: [1, 2, 3, 4], GK: [0] },
    '3-5-2': { FWD: [9, 10], MID: [4, 5, 6, 7, 8], DEF: [1, 2, 3], GK: [0] }
  };

  const currentFormation = activeFormation;

  const getIdealLineForSlot = (slotIndex: number, formation: string) => {
    const layout = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2'];
    if (layout.FWD.includes(slotIndex)) return 'FWD';
    if (layout.MID.includes(slotIndex)) return 'MID';
    if (layout.DEF.includes(slotIndex)) return 'DEF';
    if (layout.GK.includes(slotIndex)) return 'GK';
    return ''; // For Bench slots
  };

  const isCompatible = (natural: string, idealLine: string) => {
    if (!idealLine) return true;
    if (natural === idealLine) return true;
    if (['LWF', 'RWF', 'ST', 'CF'].includes(natural) && idealLine === 'FWD') return true;
    if (['CAM', 'CDM', 'CM', 'RM', 'LM'].includes(natural) && idealLine === 'MID') return true;
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(natural) && idealLine === 'DEF') return true;
    return false;
  };

  const handlePlayerClick = async (player: Player, e?: React.MouseEvent) => {

    if (!selectedPlayerId) {
      if (e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const MENU_WIDTH = 220; 
        const MENU_HEIGHT = 100;
        
        const centerX = rect.left + rect.width / 2;
        const safeX = Math.min(Math.max(centerX, MENU_WIDTH / 2 + 10), typeof window !== 'undefined' ? window.innerWidth - MENU_WIDTH / 2 - 10 : centerX);
        
        const isBelow = rect.top < MENU_HEIGHT + 20;
        const safeY = isBelow ? rect.bottom + 10 : rect.top - 10;
        
        setActiveHUD({ player, x: safeX, y: safeY, isBelow });
      } else {
        setActiveHUD({ player, x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400 });
      }
      return;
    }

    if (selectedPlayerId === player.id) {
      setSelectedPlayerId(null);
      return;
    }

    setIsSwapping(true);
    setSubmitMessage(null);
    try {
      const newPlayers = [...players];
      const p1Index = newPlayers.findIndex(p => p.id === selectedPlayerId);
      const p2Index = newPlayers.findIndex(p => p.id === player.id);
      
      if (p1Index !== -1 && p2Index !== -1) {
        const p1 = { ...newPlayers[p1Index] };
        const p2 = { ...newPlayers[p2Index] };
        
        const tempSlot = p1.lineup_slot;
        const tempStatus = p1.lineup_status;
        
        p1.lineup_slot = p2.lineup_slot;
        p1.lineup_status = p2.lineup_status;
        
        p2.lineup_slot = tempSlot;
        p2.lineup_status = tempStatus;

        newPlayers[p1Index] = p1;
        newPlayers[p2Index] = p2;
        setPlayers(newPlayers);

        // Auto-Save instantly to DB
        const payload = [
          { id: p1.id, lineup_status: p1.lineup_status, lineup_slot: p1.lineup_slot || null },
          { id: p2.id, lineup_status: p2.lineup_status, lineup_slot: p2.lineup_slot || null }
        ];
        
        const res = await updatePlayers(payload);
        
        if (!res.success) {
          toast.error(res.error || 'Failed to auto-save swap');
        } else {
          toast.success('Lineup Saved', { position: 'top-center', duration: 1500 });
        }
      }
    } catch (err: any) {
      toast.error('Network error during swap.');
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
      const res = await healAllPlayers(userId);
      if (res.success) {
        const count = res.playersHealed ?? 0;
        if (count === 0) {
          toast('All players are already healthy', { icon: '✅' });
        } else {
          toast.success(`Healed ${count} player${count > 1 ? 's' : ''}`);
          setSubmitMessage({ text: `Healed ${count} players! Balance updated.`, type: 'success' });
          setPlayers(prev => prev.map(p => ({ ...p, stamina: 100, is_injured: false })));
          window.dispatchEvent(new Event('balanceUpdated'));
        }
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
    if (!userId || !team || activeFormation === newFormation) return;
    
    setIsFormationLoading(true);
    // Optimistic UI update
    setActiveFormation(newFormation);
    
    try {
      const res = await updateTeamFormation(team.id, newFormation);
      if (res.success) {
        setTeam(prev => prev ? { ...prev, formation: newFormation } : prev);
        toast.success('Formation Saved', { position: 'top-center', duration: 1500 });
      } else {
        toast.error(res.error || 'Failed to change formation');
        // Rollback on error
        setActiveFormation(team.formation || '4-4-2');
      }
    } catch (err: any) {
      toast.error('Network error during formation change.');
      // Rollback on error
      setActiveFormation(team.formation || '4-4-2');
    } finally {
      setIsFormationLoading(false);
    }
  };

  const getPlayerInSlot = (slotIndex: number) => {
    return activePlayers.find(p => parseInt(p.lineup_slot || '-1', 10) === slotIndex);
  };

  const renderPitchMarker = (slotIndex: number) => {
    const player = getPlayerInSlot(slotIndex);
    const idealLine = getIdealLineForSlot(slotIndex, currentFormation);

    if (!player) {
      return (
        <div 
          key={`empty-${slotIndex}`} 
          className="relative flex flex-col items-center justify-center p-1 w-14 h-[84px] cursor-not-allowed transition-all rounded-md border border-dashed border-gray-600/50 bg-black/20"
        >
          <div className="w-8 h-8 rounded-full border border-gray-700/50 flex items-center justify-center bg-gray-800/30 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            <span className="text-gray-500 font-black text-[10px] opacity-40">{idealLine || 'BN'}</span>
          </div>
        </div>
      );
    }

    const isSelected = selectedPlayerId === player.id;
    const isOOP = !isCompatible(player.position, idealLine) && slotIndex <= 10;
    const displayOvr = isOOP ? Math.floor(player.ovr * 0.8) : player.ovr;

    return (
      <div 
        key={player.id} 
        onClick={(e) => handlePlayerClick(player, e)}
        className={`relative flex flex-col items-center justify-center p-1 w-14 cursor-pointer transition-all duration-300 rounded-md ${
          isSelected 
            ? 'ring-2 ring-neon-pink scale-110 z-20 bg-neon-pink/20 shadow-[0_0_15px_rgba(255,0,60,0.6)]' 
            : isOOP && viewMode === 'lineup'
              ? 'ring-1 ring-red-500 bg-red-900/40 hover:bg-red-900/60 shadow-[0_0_10px_rgba(255,0,0,0.4)]'
              : 'hover:bg-white/10'
        }`}
      >
        {/* Position Badge & Injury */}
        <div className="flex gap-0.5 items-center mb-0.5 z-10 transition-opacity duration-300">
          <span className={`text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter shadow-sm ${isOOP && viewMode === 'lineup' ? 'bg-red-500 text-white' : 'bg-neon-cyan text-black'}`}>
            {player.position}
          </span>
          {player.is_injured && <span className="text-[8px] drop-shadow-[0_0_2px_rgba(255,0,0,0.8)]">🚑</span>}
        </div>

        {/* Dynamic Center Content based on View Mode */}
        <div className="relative flex flex-col items-center justify-center h-10 w-full transition-all duration-300">
          {viewMode === 'lineup' ? (
            <div className="relative flex items-center justify-center animate-in fade-in zoom-in duration-300">
              <Shirt className={`w-9 h-9 drop-shadow-md ${isOOP ? 'text-red-500' : 'text-white'} transition-colors duration-300`} fill={isOOP ? '#ef4444' : '#ffffff'} fillOpacity={0.2} strokeWidth={1.5} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-1">
                <span className={`text-[11px] font-black drop-shadow-md ${isOOP ? 'text-red-500' : 'text-neon-cyan'}`}>{displayOvr}</span>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center gap-1 animate-in fade-in zoom-in duration-300">
              <span className={`text-[13px] font-black drop-shadow-md ${player.stamina > 70 ? 'text-neon-green' : player.stamina > 30 ? 'text-yellow-500' : 'text-red-500 animate-pulse'}`}>
                {player.stamina}
              </span>
              <div className={`w-10 h-1.5 rounded-full overflow-hidden border bg-black/50 ${player.stamina > 70 ? 'border-neon-green/50 shadow-[0_0_8px_rgba(57,255,20,0.6)]' : player.stamina > 30 ? 'border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.8)] bg-red-900/40'}`}>
                <div className={`h-full transition-all duration-1000 ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${player.stamina}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <span className="text-[10px] font-bold text-white truncate w-full text-center tracking-wider mt-0.5 drop-shadow-sm leading-tight">
          {player.name.split(' ').pop()}
        </span>
        
        {/* Old Stamina Bar (Hidden in fitness mode since we have a bigger one) */}
        {viewMode === 'lineup' && (
          <div className="w-10 h-1 mt-1 bg-gray-900 rounded-full overflow-hidden border border-gray-700 animate-in fade-in duration-300">
            <div className={`h-full ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${player.stamina}%` }}></div>
          </div>
        )}
      </div>
    );
  };

  const renderReservePlayer = (player: Player) => {
    const isSelected = selectedPlayerId === player.id;

    return (
      <div 
        key={player.id} 
        onClick={(e) => handlePlayerClick(player, e)}
        className={`relative flex flex-col items-center justify-center p-1 w-14 cursor-pointer transition-all duration-300 rounded-md ${
          isSelected 
            ? 'ring-2 ring-neon-pink scale-110 z-20 bg-neon-pink/20 shadow-[0_0_15px_rgba(255,0,60,0.6)]' 
            : 'hover:bg-white/10'
        }`}
      >
        {/* Position Badge & Injury */}
        <div className="flex gap-0.5 items-center mb-0.5 z-10 transition-opacity duration-300">
          <span className="text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter shadow-sm bg-gray-600 text-gray-300">
            {player.position}
          </span>
          {player.is_injured && <span className="text-[8px] drop-shadow-[0_0_2px_rgba(255,0,0,0.8)]">🚑</span>}
        </div>

        {/* Dynamic Center Content based on View Mode */}
        <div className="relative flex flex-col items-center justify-center h-10 w-full transition-all duration-300">
          {viewMode === 'lineup' ? (
            <div className="relative flex items-center justify-center animate-in fade-in zoom-in duration-300 opacity-60">
              <Shirt className="w-9 h-9 drop-shadow-md text-gray-400 transition-colors duration-300" fill="#9ca3af" fillOpacity={0.1} strokeWidth={1.5} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-1">
                <span className="text-[11px] font-black drop-shadow-md text-gray-400">{player.ovr}</span>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center gap-1 animate-in fade-in zoom-in duration-300 opacity-60">
              <span className={`text-[13px] font-black drop-shadow-md ${player.stamina > 70 ? 'text-neon-green' : player.stamina > 30 ? 'text-yellow-500' : 'text-red-500 animate-pulse'}`}>
                {player.stamina}
              </span>
              <div className={`w-10 h-1.5 rounded-full overflow-hidden border bg-black/50 ${player.stamina > 70 ? 'border-neon-green/50 shadow-[0_0_8px_rgba(57,255,20,0.6)]' : player.stamina > 30 ? 'border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.8)] bg-red-900/40'}`}>
                <div className={`h-full transition-all duration-1000 ${player.stamina > 70 ? 'bg-neon-green' : player.stamina > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${player.stamina}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <span className="text-[10px] font-bold text-gray-400 truncate w-full text-center tracking-wider mt-0.5 drop-shadow-sm leading-tight opacity-80">
          {player.name.split(' ').pop()}
        </span>
      </div>
    );
  };



  
  let averageOvr = 50;
  let starterCount = 0;
  let totalStarterOvr = 0;

  for (let i = 0; i <= 10; i++) {
    const p = getPlayerInSlot(i);
    if (p) {
      const idealLine = getIdealLineForSlot(i, currentFormation);
      const isOOP = !isCompatible(p.position, idealLine);
      totalStarterOvr += isOOP ? Math.floor(p.ovr * 0.8) : p.ovr;
      starterCount++;
    }
  }

  if (starterCount > 0) {
    averageOvr = Math.max(1, Math.round(totalStarterOvr / starterCount));
  }

  // Calculate projected Luxury Tax
  const LEAGUE_OVR_CAP = 80;
  const TAX_RATE_PER_OVR = 50;
  const expectedTax = Math.max(0, (averageOvr - LEAGUE_OVR_CAP) * TAX_RATE_PER_OVR);


  if (isAuthLoading || isLoading || !team) {
    return <CyberLoader fullScreen />;
  }

  if (isCorrupted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-space-dark p-6">
        <div className="bg-red-900/20 border-2 border-red-500 rounded-xl p-8 max-w-md w-full text-center shadow-[0_0_30px_rgba(255,0,0,0.3)]">
          <div className="text-5xl mb-4 animate-pulse">⚠️</div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider mb-3 text-red-500">
            Data Corruption Detected
          </h2>
          <p className="text-sm text-red-200 mb-6 font-mono">
            Обнаружено повреждение данных состава. Позиции игроков не распознаны (NULL/Invalid).
            Необходимо жестко восстановить базу данных.
          </p>
          <button
            onClick={handleEmergencyReset}
            disabled={isSubmitting}
            className={`w-full py-4 rounded-lg font-black uppercase tracking-widest transition-all ${
              isSubmitting 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(255,0,0,0.5)]'
            }`}
          >
            {isSubmitting ? 'Восстановление...' : '🚑 Восстановить БД (Hard Reset)'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-[#0B0E14] overflow-hidden">
      {/* SHAPKA */}
      <header className="bg-gray-900/50 rounded-2xl p-4 m-4 mb-2 flex justify-between items-center border border-white/5 shadow-lg backdrop-blur-md shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-white tracking-tight uppercase leading-none">{team.name}</h1>
            {expectedTax > 0 ? (
               <span className="text-[10px] bg-red-900/40 text-neon-pink border border-neon-pink/30 px-1.5 py-0.5 rounded uppercase font-bold animate-pulse">Tax (-{expectedTax})</span>
            ) : (
               <span className="text-[10px] bg-green-900/40 text-neon-green border border-neon-green/30 px-1.5 py-0.5 rounded uppercase font-bold">Tax Exempt</span>
            )}
          </div>
          <p className="text-[10px] text-neon-cyan uppercase tracking-widest mt-1">{t.squad_management}</p>
        </div>
        <div className="flex flex-col items-end justify-center">
          <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Power</div>
          <div className="text-xl font-black text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.5)] leading-none">{averageOvr}</div>
        </div>
      </header>

      {/* TABS */}
      <div className="flex justify-center mt-2 mb-1 z-10 relative shrink-0">
            <div className="bg-black/40 p-0.5 rounded-full border border-gray-800 flex shadow-sm backdrop-blur-md relative overflow-hidden">
              <div 
                className={`absolute top-0.5 bottom-0.5 w-[48%] bg-white/10 rounded-full transition-transform duration-300 ease-out border border-white/20 ${viewMode === 'lineup' ? 'translate-x-[2%]' : 'translate-x-[102%]'}`}
              ></div>
              <button
                onClick={() => setViewMode('lineup')}
                className={`relative px-4 py-1 text-[10px] z-10 font-black uppercase tracking-widest rounded-full transition-colors duration-300 w-24 ${
                  viewMode === 'lineup'
                    ? 'text-neon-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                Lineup
              </button>
              <button
                onClick={() => {
                  setViewMode('scout');
                  if (!scoutReport) {
                    setIsLoadingScout(true);
                    import('@/app/actions/scoutActions').then(({ getUpcomingOpponentScoutReport }) => {
                      getUpcomingOpponentScoutReport(userId!).then(res => {
                        if (res.success && res.data) setScoutReport(res.data);
                        setIsLoadingScout(false);
                      });
                    });
                  }
                }}
                className={`relative px-4 py-1 text-[10px] z-10 font-black uppercase tracking-widest rounded-full transition-colors duration-300 w-24 ${
                  viewMode === 'scout'
                    ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                Scout Intel
              </button>
            </div>
          </div>

      {/* PITCH */}
      <div className="flex-1 relative overflow-hidden w-full mt-2">
          {viewMode === 'scout' ? (
            <div className="absolute inset-0 animate-in fade-in p-4 overflow-y-auto">
              <div className="flex flex-col border border-gray-800 bg-black/60 rounded-xl overflow-hidden min-h-[300px]">
                {isLoadingScout ? (
                  <div className="flex-1 flex justify-center items-center py-12">
                     <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : !scoutReport || (scoutReport.players.length === 0 && scoutReport.fog_level !== 'hidden') ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-500">
                    <p className="text-sm uppercase tracking-widest font-bold">Scouts found no intel</p>
                    <p className="text-xs mt-2 text-center max-w-xs">Data is restricted or opponent roster is empty.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="bg-gradient-to-r from-red-900/30 to-transparent p-4 border-b border-red-900/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-white text-lg font-black uppercase tracking-wider">{scoutReport.opponent_team_name}</h3>
                          <p className="text-[10px] text-red-400 uppercase tracking-widest">{t.next_target} ({t.round} {scoutReport.round_number})</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-widest text-red-500/70 font-bold">{t.team_ovr}</span>
                          <span className="text-xl font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                            {scoutReport.fog_level === 'full' ? scoutReport.team_ovr_estimated : `~${scoutReport.team_ovr_estimated}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {scoutReport.fog_level === 'hidden' ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                        <Lock className="w-10 h-10 text-red-900 mb-3" />
                        <p className="text-sm uppercase tracking-widest font-black text-red-500">{t.scout_dept_lv3}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-2 max-w-[200px]">
                          {t.scout_required}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 flex flex-col gap-1">
                        {scoutReport.players.sort((a: any, b: any) => b.ovr_estimated - a.ovr_estimated).map((player: any) => (
                          <div key={player.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-gray-900/50 border border-gray-800">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white uppercase tracking-wider">{player.name}</span>
                              <span className="text-[9px] text-gray-500 font-bold uppercase">{player.position}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {scoutReport.fog_level === 'full' && player.traits?.length > 0 && (
                                <div className="flex gap-1">
                                  {player.traits.map((t: string) => (
                                    <span key={t} className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]"></span>
                                  ))}
                                </div>
                              )}
                              <div className="text-sm font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.4)] w-6 text-right">
                                {player.ovr_estimated}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col animate-in fade-in duration-500">
          <div className="flex justify-center items-center mb-1 gap-2 shrink-0">
            <button
              onClick={() => setShowChemistry(!showChemistry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                showChemistry 
                  ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]' 
                  : 'bg-black/50 text-gray-400 border-gray-800 hover:text-white hover:bg-black/70'
              }`}
            >
              {showChemistry ? <EyeOff size={14} /> : <Zap size={14} />}
              <span className="text-[10px] uppercase tracking-widest font-black">
                {showChemistry ? t.hide_links : t.chemistry}
              </span>
            </button>
            <button
              onClick={() => setShowLegend(true)}
              className="w-7 h-7 rounded-full bg-black/80 border border-neon-cyan/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.2)] text-neon-cyan font-bold hover:bg-neon-cyan/20 transition-colors"
            >
              ?
            </button>
          </div>
          <div className="flex justify-center gap-2 shrink-0 z-20 mt-1 mb-2">
            {['4-4-2', '4-3-3', '3-5-2'].map(f => {
              const isRealActive = currentFormation === f;
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

          <div className={`flex-1 relative w-[96%] mx-auto bg-green-950/30 border-2 border-neon-green/40 rounded-lg overflow-hidden shadow-[inset_0_0_40px_rgba(57,255,20,0.05)] flex flex-col items-center justify-around transition-opacity duration-300 ${isFormationLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`}>
            {/* Abstract Pitch Markings */}
            <div className="absolute top-0 w-1/2 h-16 border-2 border-t-0 border-neon-green/20 rounded-b-md"></div>
            <div className="absolute bottom-0 w-1/2 h-16 border-2 border-b-0 border-neon-green/20 rounded-t-md"></div>
            <div className="absolute top-1/2 left-0 w-full border-t-2 border-neon-green/20"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-neon-green/20 rounded-full"></div>

            {showChemistry && <ChemistryOverlay formation={currentFormation} players={activePlayers} />}

            {/* Player Mapping (Tactical Layout) */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between px-2 py-4">
              
              {/* FWD Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {(FORMATIONS[currentFormation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2']).FWD.map(idx => renderPitchMarker(idx))}
              </div>
              
              {/* MID Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {(FORMATIONS[currentFormation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2']).MID.map(idx => renderPitchMarker(idx))}
              </div>
              
              {/* DEF Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {(FORMATIONS[currentFormation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2']).DEF.map(idx => renderPitchMarker(idx))}
              </div>
              
              {/* GK Line */}
              <div className="w-full flex justify-around items-center h-[20%]">
                 {(FORMATIONS[currentFormation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2']).GK.map(idx => renderPitchMarker(idx))}
              </div>
            </div>
          </div>

        </div>
        )}
      </div>

      {/* PODVAL */}
      {viewMode === 'lineup' && (
        <div className="shrink-0 bg-black/60 border-t border-white/5 p-3 flex flex-col gap-2 z-20 pb-4">
           {submitMessage && (
             <div className={`p-1.5 rounded text-[10px] uppercase tracking-widest text-center border font-semibold ${submitMessage.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-green-900/20 text-neon-green border-neon-green/40'}`}>
               {submitMessage.text}
             </div>
           )}
           <div className="flex items-center justify-center gap-3 mb-2 text-[9px] uppercase tracking-widest font-bold">
             <span className="text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.3)]">СКАМЕЙКА</span>
             {activePlayers.filter(p => p.lineup_status === 'reserve').length > 0 && (
               <>
                 <span className="text-gray-700">|</span>
                 <span className="text-gray-500">ГЛУБОКИЙ РЕЗЕРВ</span>
               </>
             )}
           </div>

           <div className="w-full overflow-x-auto custom-scrollbar overflow-y-hidden">
             <div className="flex gap-3 px-4 pb-2 items-center w-max min-w-full justify-start md:justify-center">
               {/* BENCH PLAYERS */}
               <div className="flex gap-2 shrink-0">
                 {[11, 12, 13, 14, 15].map(idx => (
                   <div key={idx} className="shrink-0">
                     {renderPitchMarker(idx)}
                   </div>
                 ))}
               </div>
               
               {/* VERTICAL DIVIDER */}
               {activePlayers.filter(p => p.lineup_status === 'reserve').length > 0 && (
                 <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-700 to-transparent shrink-0 mx-2"></div>
               )}

               {/* DEEP RESERVE PLAYERS */}
               <div className="flex gap-2 shrink-0">
                 {activePlayers.filter(p => p.lineup_status === 'reserve').map(p => (
                   <div key={p.id} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity scale-95">
                     {renderReservePlayer(p)}
                   </div>
                 ))}
               </div>
             </div>
           </div>

           {players.filter(p => p.stamina < 100).length > 0 && (
             <button 
               onClick={handleMassHeal}
               disabled={isHealingAll || isSubmitting || isSwapping}
               className={`w-full py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex justify-center items-center gap-1.5 transition-all ${
                 isHealingAll || isSubmitting || isSwapping
                   ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                   : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan hover:text-black shadow-[0_0_10px_rgba(0,240,255,0.2)]'
               }`}
             >
              <span className="text-sm">⚡</span>
               <span>Heal All ({players.filter(p => p.stamina < 100 || p.is_injured).length} players) · {players.reduce((sum, p) => sum + Math.max(0, 100 - (p.stamina ?? 100)), 0)} SP</span>
             </button>
           )}
        </div>
      )}



      {/* FLOATING HUD: Player Context Menu */}
      <AnimatePresence>
        {activeHUD && (
          <>
            {/* Overlay to catch clicks and close HUD */}
            <motion.div 
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" 
              onClick={() => setActiveHUD(null)} 
            />
            
            {/* Popover Menu */}
            <motion.div 
              key="menu"
              initial={{ opacity: 0, scale: 0.8, x: "-50%", y: activeHUD.isBelow ? "-50%" : "-80%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: activeHUD.isBelow ? "0%" : "-100%" }}
              exit={{ opacity: 0, scale: 0.8, x: "-50%", y: activeHUD.isBelow ? "-50%" : "-80%" }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed z-50 bg-gray-950/90 backdrop-blur-md border border-neon-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] rounded-xl p-3 flex flex-row gap-3"
              style={{ left: activeHUD.x, top: activeHUD.y }}
            >
              <button
                onClick={() => {
                  const id = activeHUD.player.id;
                  setActiveHUD(null);
                  setSelectedPlayerId(id);
                }}
                className="px-4 py-2 rounded-lg font-black uppercase tracking-widest bg-black/60 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan hover:text-black transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)] flex flex-col items-center justify-center gap-1 min-w-[90px]"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="text-[10px]">ЗАМЕНИТЬ</span>
              </button>
              
              <button
                onClick={() => {
                  setProfilePlayer(activeHUD.player);
                  setActiveHUD(null);
                }}
                className="px-4 py-2 rounded-lg font-black uppercase tracking-widest bg-black/60 text-gray-300 border border-gray-600 hover:border-white hover:text-white transition-all shadow-[0_0_10px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center gap-1 min-w-[90px]"
              >
                <User className="w-5 h-5" />
                <span className="text-[10px]">ПРОФИЛЬ</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profilePlayer && userId && (
          <PlayerProfileModal 
            player={profilePlayer} 
            userId={userId} 
            onClose={() => setProfilePlayer(null)}
            onTrainSuccess={(updatedPlayer, newBalance) => {
              setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p));
              setProfilePlayer(updatedPlayer);
            }}
          />
        )}
      </AnimatePresence>

      {/* Legend Modal */}
      {showLegend && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowLegend(false)}
        >
          <div 
            className="w-full max-w-sm bg-black/90 border border-neon-cyan/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.3)] relative"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowLegend(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-white font-bold text-base mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse"></span>
              Синергия (Match Engine)
            </h3>
            
            <div className="space-y-4 text-sm text-gray-300">
              <p className="border-b border-gray-800 pb-3">
                <span className="text-neon-cyan font-bold block mb-1">Как это работает:</span>
                Связки стилей дают <strong className="text-neon-green">+10%</strong> к статам в дуэлях. Конфликты (два Лидера) забирают <strong className="text-red-500">-15%</strong>.
              </p>

              <div>
                <span className="text-gray-400 block mb-2">Классы стилей (Трейты):</span>
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-teal-900/80 border-teal-500 text-teal-400 text-[7px] font-black">SN</span><span className="text-[10px] text-gray-300">Sniper</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-blue-900/80 border-blue-500 text-blue-400 text-[7px] font-black">PM</span><span className="text-[10px] text-gray-300">Playmaker</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-purple-900/80 border-purple-500 text-purple-400 text-[7px] font-black">WL</span><span className="text-[10px] text-gray-300">Wall</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-orange-900/80 border-orange-500 text-orange-400 text-[7px] font-black">SP</span><span className="text-[10px] text-gray-300">Speedster</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-indigo-900/80 border-indigo-500 text-indigo-400 text-[7px] font-black">AN</span><span className="text-[10px] text-gray-300">Anchor</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-pink-900/80 border-pink-500 text-pink-400 text-[7px] font-black">PO</span><span className="text-[10px] text-gray-300">Poacher</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-yellow-900/80 border-yellow-500 text-yellow-400 text-[7px] font-black">EN</span><span className="text-[10px] text-gray-300">Engine</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-red-900/80 border-red-500 text-red-400 text-[7px] font-black">LD</span><span className="text-[10px] text-gray-300">Leader</span></div>
                </div>

                <span className="text-gray-400 block mb-2">Комбинации:</span>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Playmaker + Poacher</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Engine + Speedster</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span>Anchor + Wall</span>
                    <span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-red-900/20 p-2 rounded mt-2 border border-red-900/50">
                    <span>Leader + Leader</span>
                    <span className="text-red-500 font-bold">-15%</span>
                  </li>
                </ul>
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-800">
                <span className="text-gray-400 block mb-2">Связи на поле (Линии):</span>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-[#39ff14] shadow-[0_0_5px_#39ff14]"></div>
                  <span>Отличная (Матчи + Стиль)</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-yellow-500"></div>
                  <span>Базовая (Позиции)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 border-t-2 border-dashed border-red-500"></div>
                  <span>Конфликт</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScreenGuide 
        screenName="squad" 
        title={t.squad_management} 
        content={t.squad_management_desc} 
      />
    </div>
  );
}
