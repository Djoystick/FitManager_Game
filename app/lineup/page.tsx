'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { useRouter } from 'next/navigation';
import { swapPlayers, updatePlayers, updateTeamFormation } from '@/app/actions/lineupActions';
import { healAllPlayers } from '@/app/actions/baseActions';
import toast from 'react-hot-toast';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { Shirt, X, RefreshCw, User, Eye, EyeOff, Zap, Lock, Building2, Shuffle, Users, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerProfileModal } from '@/components/PlayerProfileModal';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { useTutorial } from '@/components/providers/TutorialContext';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ChemistryOverlay } from '@/components/ChemistryOverlay';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { PlayerListRow } from '@/components/ui/PlayerListRow';
import { StatCard } from '@/components/ui/StatCard';
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
  const router = useRouter();
  const { step, isDone, nextStep, skipTutorial } = useTutorial();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFormationLoading, setIsFormationLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isHealingAll, setIsHealingAll] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isBenchOpen, setIsBenchOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'lineup' | 'scout'>('lineup');
  const [scoutReport, setScoutReport] = useState<any>(null);
  const [isLoadingScout, setIsLoadingScout] = useState(false);
  const [activeFormation, setActiveFormation] = useState('4-4-2');
  const [hasCheckedCorruption, setHasCheckedCorruption] = useState(false);
  const [activeHUD, setActiveHUD] = useState<{player: Player, x: number, y: number, isBelow?: boolean} | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [showChemistry, setShowChemistry] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  // Primary TEAM tab
  const [primaryTab, setPrimaryTab] = useState<'info' | 'players' | 'lineup'>('info');

  // Force the primary tab to 'lineup' during step 1 so the bench-drawer-handle is visible
  useEffect(() => {
    if (!isDone && step === 1 && primaryTab !== 'lineup') {
      setPrimaryTab('lineup');
    }
  }, [step, isDone, primaryTab]);
  const [playersSubTab, setPlayersSubTab] = useState<'squad' | 'academy'>('squad');

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
      setTimeout(() => fetchTeamData(), 0);
    } else if (!isAuthLoading && !isAuthenticated) {
      setTimeout(() => setIsLoading(false), 0);
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

  const FORMATIONS: Record<string, { FWD: number[]; MID: number[]; DEF: number[]; GK: number[]; CAM?: number[]; CDM?: number[] }> = {
    '4-4-2':   { GK: [0], DEF: [1,2,3,4],   MID: [5,6,7,8],      FWD: [9,10]    },
    '4-3-3':   { GK: [0], DEF: [1,2,3,4],   MID: [5,6,7],        FWD: [8,9,10]  },
    '3-5-2':   { GK: [0], DEF: [1,2,3],     MID: [4,5,6,7,8],    FWD: [9,10]    },
    '4-2-3-1': { GK: [0], DEF: [1,2,3,4],   CDM: [5,6], CAM: [7,8,9], MID: [],  FWD: [10]  },
    '4-1-4-1': { GK: [0], DEF: [1,2,3,4],   CDM: [5],   MID: [6,7,8,9], FWD: [10] },
    '5-3-2':   { GK: [0], DEF: [1,2,3,4,5], MID: [6,7,8],        FWD: [9,10]    },
    '3-4-3':   { GK: [0], DEF: [1,2,3],     MID: [4,5,6,7],      FWD: [8,9,10]  },
    '4-5-1':   { GK: [0], DEF: [1,2,3,4],   MID: [5,6,7,8,9],    FWD: [10]      },
  };

  // Map slot → line label for all formations including special roles
  const getIdealLineForSlot = (slotIndex: number, formation: string): string => {
    const layout = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    if (layout.FWD.includes(slotIndex)) return 'FWD';
    if (layout.CAM && layout.CAM.includes(slotIndex)) return 'MID'; // CAM plays as MID compatible
    if (layout.CDM && layout.CDM.includes(slotIndex)) return 'MID'; // CDM plays as MID compatible
    if (layout.MID.includes(slotIndex)) return 'MID';
    if (layout.DEF.includes(slotIndex)) return 'DEF';
    if (layout.GK.includes(slotIndex)) return 'GK';
    return '';
  };

  // Render helper: get all slot indices for a formation in order (FWD→CAM→MID→CDM→DEF→GK)
  // Bug-fix: previously 4-1-4-1 never rendered its CDM line because the
  // CDM/MID branching swallowed the CDM row when CAM was absent.
  // New logic treats every midfield layer (CAM, MID, CDM) as independent.
  const getFormationLines = (formation: string): number[][] => {
    const layout = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const lines: number[][] = [];
    if (layout.FWD.length > 0) lines.push(layout.FWD);               // Forwards
    if (layout.CAM && layout.CAM.length > 0) lines.push(layout.CAM); // Attacking mid
    if (layout.MID.length > 0) lines.push(layout.MID);               // Central mid
    if (layout.CDM && layout.CDM.length > 0) lines.push(layout.CDM); // Defensive mid
    if (layout.DEF.length > 0) lines.push(layout.DEF);               // Defenders
    if (layout.GK.length > 0)  lines.push(layout.GK);                // Goalkeeper
    return lines;
  };

  // Alias so existing JSX references still work
  const currentFormation = activeFormation;

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
      const res = await healAllPlayers();
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
  
  let attOvr = 0, midOvr = 0, defOvr = 0;
  let attCount = 0, midCount = 0, defCount = 0;

  for (let i = 0; i <= 10; i++) {
    const p = getPlayerInSlot(i);
    if (p) {
      const idealLine = getIdealLineForSlot(i, currentFormation);
      const isOOP = !isCompatible(p.position, idealLine);
      const effOvr = isOOP ? Math.floor(p.ovr * 0.8) : p.ovr;
      totalStarterOvr += effOvr;
      starterCount++;
      
      if (idealLine === 'FWD') { attOvr += effOvr; attCount++; }
      else if (idealLine === 'MID') { midOvr += effOvr; midCount++; }
      else if (idealLine === 'DEF' || idealLine === 'GK') { defOvr += effOvr; defCount++; }
    }
  }

  if (starterCount > 0) {
    averageOvr = Math.max(1, Math.round(totalStarterOvr / starterCount));
  }
  
  const avgAtt = attCount > 0 ? Math.round(attOvr / attCount) : 0;
  const avgMid = midCount > 0 ? Math.round(midOvr / midCount) : 0;
  const avgDef = defCount > 0 ? Math.round(defOvr / defCount) : 0;

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
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#05060f' }}>
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none bg-grid-violet opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(147,51,234,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(147,51,234,0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(147,51,234,0.08)_0%,transparent_100%)]" />

      {/* Tutorial Spotlight Step 1 */}
      {!isDone && step === 1 && (
        <SpotlightOverlay
          targetId="bench-drawer-handle"
          title="🔄 Скамья запасных"
          description="Твои основные игроки устают. Открой скамейку запасных, чтобы выпустить свежих игроков на поле!"
          buttonLabel="Я понял →"
          onNext={() => {
            nextStep();
          }}
          onSkip={skipTutorial}
        />
      )}

      {/* Tutorial Spotlight Step 2 */}
      {!isDone && step === 2 && (
        <SpotlightOverlay
          targetId="tab-info"
          title="📊 Управление и Статистика"
          description="Отличная расстановка! Теперь давай посмотрим на общую статистику команды и доступные структуры. Перейди во вкладку INFO."
          buttonLabel="Понятно →"
          onNext={() => {
            nextStep();
            setPrimaryTab('info');
          }}
          onSkip={skipTutorial}
        />
      )}

      {/* Tutorial Spotlight Step 3 */}
      {!isDone && step === 3 && primaryTab === 'info' && (
        <SpotlightOverlay
          targetId="card-structures"
          title="🏢 Развитие Базы"
          description="Здесь ты можешь строить и улучшать стадион и тренировочные базы. Давай перейдем в Структуры!"
          buttonLabel="Перейти на Базу →"
          onNext={() => {
            nextStep();
            router.push('/base');
          }}
          onSkip={skipTutorial}
        />
      )}

      {/* HEADER */}
      <header className="glass-card-violet relative overflow-hidden mx-3 mt-3 mb-1 p-3 flex justify-between items-center shrink-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-white tracking-wider uppercase leading-none font-orbitron">{team.name}</h1>
            {expectedTax > 0 ? (
               <span className="text-[8px] bg-red-900/30 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded-full uppercase font-bold animate-pulse">Tax −{expectedTax}</span>
            ) : (
               <span className="text-[8px] bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase font-bold">Tax Free</span>
            )}
          </div>
          <p className="text-[8px] text-violet-400/70 uppercase tracking-widest mt-0.5 font-bold">{t.squad_management}</p>
        </div>
        <div className="flex items-center gap-2">
          {players.filter(p => p.stamina < 100 || p.is_injured).length > 0 && (
            <button
              onClick={handleMassHeal}
              disabled={isHealingAll || isSubmitting || isSwapping}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase
                          tracking-wider border transition-all ${
                isHealingAll || isSubmitting || isSwapping
                  ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(0,240,255,0.2)] active:scale-95'
              }`}
            >
              <span>⚡</span>
              <span>
                {isHealingAll ? '…' : `Heal (${players.filter(p => p.stamina < 100 || p.is_injured).length})`}
              </span>
            </button>
          )}
          <div className="flex flex-col items-end">
            <div className="text-[8px] uppercase tracking-widest text-gray-600 font-bold">OVR</div>
            <div className="text-2xl font-black font-orbitron text-emerald-300 neon-text-green leading-none">{averageOvr}</div>
          </div>
        </div>
      </header>

      {/* ── Primary SubNav: INFO | PLAYERS | LINEUP ── */}
      <div className="flex-shrink-0 pb-1.5 relative z-20">
        <SubNavTabs
          tabs={[
            { id: 'info',    label: t.team_info || 'INFO'    },
            { id: 'players', label: t.team_players || 'PLAYERS', badge: players.length },
            { id: 'lineup',  label: t.team_lineup || 'LINEUP'  },
          ]}
          active={primaryTab}
          onChange={(id) => setPrimaryTab(id as 'info' | 'players' | 'lineup')}
          accent="violet"
        />
      </div>

      {/* ── INFO Tab ─────────────────────────────────────────────────── */}
      {primaryTab === 'info' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 px-3 flex flex-col gap-3 relative z-10">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="General OVR" value={averageOvr} accent="violet" />
            <StatCard label="ATT" value={avgAtt || '—'} accent="cyan" />
            <StatCard label="DEF" value={avgDef || '—'} accent="emerald" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Squad Size" value={players.length} subLabel="players" accent="yellow" />
            <StatCard label="Formation" value={currentFormation} accent="violet" />
          </div>

          {/* Management — Web3 gradient cards */}
          <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold px-0.5">Management</div>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: t.team_structures || 'STRUCTURES', sub: t.team_club_stadium || 'Club & Stadium',   href: '/base',   bg: 'from-teal-950 to-cyan-950',    border: 'border-teal-700/30',    hb: 'hover:border-teal-400/60',    glow: 'hover:shadow-[0_0_20px_rgba(20,184,166,0.18)]',  accent: 'text-teal-400',   Icon: Building2 },
              { label: t.team_transfers || 'TRANSFERS',  sub: t.team_buy_sell || 'Buy & Sell',       href: '/market', bg: 'from-violet-950 to-purple-950', border: 'border-violet-700/30',  hb: 'hover:border-violet-400/60',  glow: 'hover:shadow-[0_0_20px_rgba(139,92,246,0.18)]',  accent: 'text-violet-400', Icon: Shuffle   },
              { label: t.team_staff || 'STAFF',      sub: t.team_coaches || 'Coaches & Scouts', href: '/staff',  bg: 'from-emerald-950 to-green-950', border: 'border-emerald-700/30', hb: 'hover:border-emerald-400/60', glow: 'hover:shadow-[0_0_20px_rgba(52,211,153,0.18)]',   accent: 'text-emerald-400', Icon: Users    },
              { label: t.team_finances || 'FINANCES',   sub: t.team_fancoins || 'FanCoins & W2E',   href: '/bank',   bg: 'from-yellow-950 to-amber-950',  border: 'border-yellow-700/30',  hb: 'hover:border-yellow-400/60',  glow: 'hover:shadow-[0_0_20px_rgba(234,179,8,0.18)]',   accent: 'text-yellow-400', Icon: Wallet   },
            ]).map(({ label, sub, href, bg, border, hb, glow, accent, Icon }) => (
              <motion.div key={href} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href={href}
                  id={href === '/base' ? 'card-structures' : undefined}
                  className={`flex flex-col gap-2.5 p-3 rounded-2xl overflow-hidden bg-gradient-to-br ${bg} border ${border} ${hb} ${glow} transition-all duration-300 block`}
                >
                  <div className={`w-8 h-8 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center ${accent}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-[7px] text-gray-600 uppercase tracking-widest font-bold leading-none mb-0.5">{sub}</div>
                    <div className={`text-[11px] font-black uppercase tracking-wide leading-tight ${accent}`}>{label}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLAYERS Tab ──────────────────────────────────────────────── */}
      {primaryTab === 'players' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Sub-nav with live counts */}
          <div className="flex-shrink-0 pb-2">
            <SubNavTabs
              tabs={[
                { id: 'squad',   label: `SQUAD (${activePlayers.filter(p => p.age >= 18).length})` },
                { id: 'academy', label: `ACADEMY (${activePlayers.filter(p => p.age < 18).length})` },
              ]}
              active={playersSubTab}
              onChange={(id) => setPlayersSubTab(id as 'squad' | 'academy')}
              accent="cyan"
            />
          </div>

          {/* 26-player hard cap warning */}
          {activePlayers.length > 26 && (
            <div className="flex-shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl
                            bg-red-500/10 border border-red-500/40
                            flex items-center gap-2.5
                            shadow-[0_0_16px_rgba(239,68,68,0.12)]">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div className="min-w-0">
                <div className="text-[9px] font-black text-red-400 uppercase tracking-widest">Squad cap exceeded</div>
                <div className="text-[8px] text-red-400/70">
                  Max 26 players · Release {activePlayers.length - 26} player{activePlayers.length - 26 > 1 ? 's' : ''} via Transfers
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 relative z-10">
            {playersSubTab === 'academy' && activePlayers.filter(p => p.age < 18).length === 0 ? (
              /* Academy empty state */
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-2xl">🎓</div>
                <div>
                  <div className="text-[10px] font-black text-white uppercase tracking-widest mb-1">No Academy Players</div>
                  <div className="text-[8px] text-gray-600 uppercase tracking-wider max-w-[180px] mx-auto">
                    Players under 18 appear here after signing youth talent
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card mx-3 overflow-hidden">
                {activePlayers
                  .filter(p => playersSubTab === 'squad' ? p.age >= 18 : p.age < 18)
                  .sort((a, b) => b.ovr - a.ovr)
                  .map(player => (
                    <PlayerListRow
                      key={player.id}
                      player={{
                        id: player.id,
                        name: player.name,
                        age: player.age,
                        ovr: player.ovr,
                        position: player.position,
                        is_injured: player.is_injured,
                        stamina: player.stamina,
                      }}
                      onClick={() => setProfilePlayer(player)}
                      isSelected={profilePlayer?.id === player.id}
                    />
                  ))
                }
              </div>
            )}
          </div>
        </div>
      )}
      {/* LINEUP Tab — existing pitch layout */}
      {primaryTab === 'lineup' && (
      <>{/* TABS */}
      <div className="flex justify-center mt-1.5 mb-1 z-10 relative shrink-0 px-3">
        <div className="glass-card flex w-full p-0.5 gap-0.5 relative">
          <div
            className="absolute inset-y-0.5"
            style={{
              left: viewMode === 'lineup' ? '0.125rem' : '50%',
              width: 'calc(50% - 0.125rem)',
              transition: 'left 0.3s ease-out',
              background: viewMode === 'lineup' ? 'rgba(0,240,255,0.12)' : 'rgba(239,68,68,0.12)',
              borderRadius: '0.625rem',
              border: `1px solid ${viewMode === 'lineup' ? 'rgba(0,240,255,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          />
          <button
            onClick={() => setViewMode('lineup')}
            className={`relative flex-1 py-1.5 text-[9px] z-10 font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${
              viewMode === 'lineup' ? 'text-cyan-300' : 'text-gray-500 hover:text-white'
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
            className={`relative flex-1 py-1.5 text-[9px] z-10 font-black uppercase tracking-widest rounded-lg transition-colors duration-300 ${
              viewMode === 'scout' ? 'text-red-400' : 'text-gray-500 hover:text-white'
            }`}
          >
            Scout Intel
          </button>
        </div>
      </div>

      {/* PITCH */}
      <div className="flex-1 relative overflow-hidden w-full mt-1 z-10">
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
          <div className="flex justify-center items-center mb-1 gap-2 shrink-0 px-3">
            <button
              onClick={() => setShowChemistry(!showChemistry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                showChemistry
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'glass-card text-gray-500 hover:text-white'
              }`}
            >
              {showChemistry ? <EyeOff size={12} /> : <Zap size={12} />}
              <span className="text-[9px] uppercase tracking-widest font-black">
                {showChemistry ? t.hide_links : t.chemistry}
              </span>
            </button>
            <button
              onClick={() => setShowLegend(true)}
              className="w-7 h-7 rounded-full glass-card flex items-center justify-center text-violet-400 font-bold hover:bg-violet-500/20 transition-colors text-sm"
            >
              ?
            </button>
          </div>
          {/* Formation selector — scrollable row of 8 */}
          <div className="shrink-0 z-20 px-2 mb-1">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {Object.keys(FORMATIONS).map(f => {
                const isActive = currentFormation === f;
                return (
                  <button
                    key={f}
                    onClick={() => handleFormationChange(f)}
                    disabled={isFormationLoading}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black
                                uppercase tracking-widest transition-all border whitespace-nowrap ${
                      isActive
                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/50 shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                        : 'bg-black/30 border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                    } ${isFormationLoading ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 w-[96%] mx-auto flex flex-col justify-start gap-3 pb-2">
            
            {/* Tactical Blueprint Pitch */}
            <div className={`relative w-full aspect-[4/5] max-h-[420px] mx-auto rounded-xl overflow-hidden flex flex-col items-center justify-around transition-opacity duration-300 shadow-[0_0_20px_rgba(0,0,0,0.8)] ${isFormationLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                 style={{ 
                   background: '#0a0a0a', 
                   border: '1px solid rgba(0, 240, 255, 0.3)', 
                   boxShadow: 'inset 0 0 30px rgba(0, 240, 255, 0.05)',
                   backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)',
                   backgroundSize: '20px 20px'
                 }}>
              {/* Pitch Markings — neon cyan lines */}
              <div className="absolute top-0 w-[45%] h-14 rounded-b-2xl" style={{ border: '1px solid rgba(0,240,255,0.15)', borderTop: 'none' }} />
              <div className="absolute bottom-0 w-[45%] h-14 rounded-t-2xl" style={{ border: '1px solid rgba(0,240,255,0.15)', borderBottom: 'none' }} />
              <div className="absolute top-1/2 left-0 w-full" style={{ borderTop: '1px solid rgba(0,240,255,0.12)' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full" style={{ border: '1px solid rgba(0,240,255,0.12)' }} />
              {/* Center spot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/30" />

              {showChemistry && <ChemistryOverlay formation={currentFormation} players={activePlayers} />}

              {/* Player Mapping (Tactical Layout) */}
              <div className="relative z-10 w-full h-full flex flex-col justify-between px-2 py-4">
                {getFormationLines(currentFormation).map((lineSlots, lineIdx) => (
                  <div key={lineIdx} className="w-full flex justify-around items-center" style={{ minHeight: 0, flex: '1 1 0' }}>
                    {lineSlots.map(idx => renderPitchMarker(idx))}
                  </div>
                ))}
              </div>
            </div>

            {/* Team Analytics Dashboard */}
            <div className="w-full shrink-0 flex gap-2">
              <div className="flex-1 glass-card-violet p-2 flex flex-col items-center justify-center gap-1 rounded-xl">
                <span className="text-[8px] uppercase tracking-widest text-gray-400 font-bold">АТАКА</span>
                <span className="text-sm font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]">{avgAtt}</span>
              </div>
              <div className="flex-1 glass-card-cyan p-2 flex flex-col items-center justify-center gap-1 rounded-xl">
                <span className="text-[8px] uppercase tracking-widest text-gray-400 font-bold">ПОЛУЗАЩИТА</span>
                <span className="text-sm font-black text-cyan-300 drop-shadow-[0_0_5px_rgba(0,240,255,0.4)]">{avgMid}</span>
              </div>
              <div className="flex-1 glass-card p-2 flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-700/50">
                <span className="text-[8px] uppercase tracking-widest text-gray-400 font-bold">ЗАЩИТА</span>
                <span className="text-sm font-black text-gray-300">{avgDef}</span>
              </div>
            </div>
          </div>
          </div>
          )}
        </div>

      {/* ═══════════════════════════════════════════════════════════════
          BENCH DRAWER TRIGGER BAR (always visible in lineup mode)
      ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'lineup' && (
        <div className="shrink-0 z-20 px-3 pb-1">
          {submitMessage && (
            <div className={`mb-1.5 p-1.5 rounded-lg text-[9px] uppercase tracking-widest text-center border font-semibold ${
              submitMessage.type === 'error'
                ? 'bg-red-900/20 text-red-400 border-red-500/30'
                : 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {submitMessage.text}
            </div>
          )}

          {/* Bench toggle button */}
          <button
            id="bench-drawer-handle"
            onClick={() => setIsBenchOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-98"
            style={{
              background: 'rgba(147,51,234,0.08)',
              border: '1px solid rgba(147,51,234,0.2)',
              boxShadow: isBenchOpen ? '0 0 16px rgba(147,51,234,0.25)' : 'none',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-300">Скамейка & Резерв</span>
              <span className="text-[8px] text-gray-600 font-mono">
                ({[11,12,13,14,15].filter(idx => getPlayerInSlot(idx)).length}/5 bench)
              </span>
            </div>
            <motion.div
              animate={{ rotate: isBenchOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-violet-400"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </motion.div>
          </button>
        </div>
      )}

      {/* Bottom tab bar spacer */}
      <div className="h-16 flex-shrink-0" />

      {/* ═══════════════════════════════════════════════════════════════
          BENCH BOTTOM SHEET DRAWER
      ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isBenchOpen && viewMode === 'lineup' && (
          <>
            <motion.div
              key="bench-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
              onClick={() => setIsBenchOpen(false)}
            />
            <motion.div
              key="bench-drawer"
              initial={{ y: '100%', x: '-50%' }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: '100%', x: '-50%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed bottom-0 left-1/2 w-full max-w-[480px] z-[60] pb-20 rounded-t-3xl border-t border-cyan-500/30 shadow-[0_-10px_40px_rgba(0,240,255,0.15)]"
              style={{ background: 'rgba(5,6,15,0.95)', backdropFilter: 'blur(20px)' }}
            >
              {/* High-tech Drag Handle */}
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-12 h-1.5 rounded-full bg-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
              </div>

              <div className="px-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Скамейка</span>
                </div>
                {activePlayers.filter(p => p.lineup_status === 'reserve').length > 0 && (
                  <span className="text-[8px] text-gray-500 uppercase tracking-widest border border-gray-700/50 px-2 py-0.5 rounded-full">Резерв ➔</span>
                )}
              </div>

              {/* Players row */}
              <div className="overflow-x-auto scrollbar-none px-4 pb-3">
                <div className="flex gap-2 w-max">
                  {[11, 12, 13, 14, 15].map(idx => (
                    <div key={idx} className="shrink-0">{renderPitchMarker(idx)}</div>
                  ))}
                  {activePlayers.filter(p => p.lineup_status === 'reserve').length > 0 && (
                    <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent self-center mx-1" />
                  )}
                  {activePlayers.filter(p => p.lineup_status === 'reserve').map(p => (
                    <div key={p.id} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                      {renderReservePlayer(p)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Heal button */}
              {players.filter(p => p.stamina < 100 || p.is_injured).length > 0 && (
                <div className="px-4 pb-2">
                  <button
                    onClick={handleMassHeal}
                    disabled={isHealingAll || isSubmitting || isSwapping}
                    className={`w-full py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-wider flex justify-center items-center gap-1.5 transition-all border ${
                      isHealingAll || isSubmitting || isSwapping
                        ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                        : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Heal All ({players.filter(p => p.stamina < 100 || p.is_injured).length}) · {players.reduce((sum, p) => sum + Math.max(0, 100 - (p.stamina ?? 100)), 0)} SP</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FLOATING HUD: Player Context Menu */}
      <AnimatePresence>
        {activeHUD && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
              onClick={() => setActiveHUD(null)}
            />

            {/* Popover Menu */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.85, x: '-50%', y: activeHUD.isBelow ? '-50%' : '-80%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: activeHUD.isBelow ? '0%' : '-100%' }}
              exit={{ opacity: 0, scale: 0.85, x: '-50%', y: activeHUD.isBelow ? '-50%' : '-80%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed z-[110] glass-card-violet rounded-2xl p-3 flex flex-row gap-2"
              style={{ left: activeHUD.x, top: activeHUD.y, boxShadow: '0 0 30px rgba(147,51,234,0.3)' }}
            >
              <button
                onClick={() => {
                  const id = activeHUD.player.id;
                  setActiveHUD(null);
                  setSelectedPlayerId(id);
                }}
                className="px-4 py-2.5 rounded-xl font-black uppercase tracking-widest glass-card-cyan text-cyan-300
                           hover:bg-cyan-500/20 transition-all flex flex-col items-center gap-1 min-w-[80px] text-[9px]"
              >
                <RefreshCw className="w-4 h-4" />
                ЗАМЕНИТЬ
              </button>
              <button
                onClick={() => {
                  setProfilePlayer(activeHUD.player);
                  setActiveHUD(null);
                }}
                className="px-4 py-2.5 rounded-xl font-black uppercase tracking-widest glass-card text-gray-300
                           hover:text-white transition-all flex flex-col items-center gap-1 min-w-[80px] text-[9px]"
              >
                <User className="w-4 h-4" />
                ПРОФИЛЬ
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

      {/* Legend Modal — compact to prevent overflow on small TMA screens */}
      {showLegend && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowLegend(false)}
        >
          <div
            className="w-full max-w-[480px] max-h-[72vh] overflow-y-auto custom-scrollbar glass-card-violet rounded-b-none p-4 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
            <h3 className="text-white font-bold text-xs mb-2.5 uppercase tracking-wider flex items-center gap-2 font-orbitron">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              Синергия (Match Engine)
            </h3>

            <div className="space-y-2.5 text-xs text-gray-300">
              <p className="border-b border-gray-800 pb-2">
                <span className="text-neon-cyan font-bold block mb-0.5">Как это работает:</span>
                Связки стилей дают <strong className="text-neon-green">+10%</strong> к статам в дуэлях. Конфликты (два Лидера) забирают <strong className="text-red-500">-15%</strong>.
              </p>

              <div>
                <span className="text-gray-400 block mb-1.5">Классы стилей (Трейты):</span>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-teal-900/80 border-teal-500 text-teal-400 text-[7px] font-black">SN</span><span className="text-[9px] text-gray-300">Sniper</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-blue-900/80 border-blue-500 text-blue-400 text-[7px] font-black">PM</span><span className="text-[9px] text-gray-300">Playmaker</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-purple-900/80 border-purple-500 text-purple-400 text-[7px] font-black">WL</span><span className="text-[9px] text-gray-300">Wall</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-orange-900/80 border-orange-500 text-orange-400 text-[7px] font-black">SP</span><span className="text-[9px] text-gray-300">Speedster</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-indigo-900/80 border-indigo-500 text-indigo-400 text-[7px] font-black">AN</span><span className="text-[9px] text-gray-300">Anchor</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-pink-900/80 border-pink-500 text-pink-400 text-[7px] font-black">PO</span><span className="text-[9px] text-gray-300">Poacher</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-yellow-900/80 border-yellow-500 text-yellow-400 text-[7px] font-black">EN</span><span className="text-[9px] text-gray-300">Engine</span></div>
                  <div className="flex items-center gap-1"><span className="w-4 h-4 flex items-center justify-center rounded-full border bg-red-900/80 border-red-500 text-red-400 text-[7px] font-black">LD</span><span className="text-[9px] text-gray-300">Leader</span></div>
                </div>

                <span className="text-gray-400 block mb-1.5">Комбинации:</span>
                <ul className="space-y-1">
                  <li className="flex items-center justify-between bg-gray-900/50 px-2 py-1.5 rounded">
                    <span>Playmaker + Poacher</span><span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 px-2 py-1.5 rounded">
                    <span>Engine + Speedster</span><span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-gray-900/50 px-2 py-1.5 rounded">
                    <span>Anchor + Wall</span><span className="text-neon-green font-bold">+10%</span>
                  </li>
                  <li className="flex items-center justify-between bg-red-900/20 px-2 py-1.5 rounded border border-red-900/50">
                    <span>Leader + Leader</span><span className="text-red-500 font-bold">-15%</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <span className="text-gray-400 block mb-1.5">Связи на поле (Линии):</span>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-1 bg-[#39ff14] shadow-[0_0_5px_#39ff14]"></div>
                  <span>Отличная (Матчи + Стиль)</span>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
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

      </> /* end LINEUP tab fragment */
      )} {/* end primaryTab === 'lineup' */}

      <ScreenGuide 
        screenName="squad" 
        title={t.squad_management} 
        content={t.squad_management_desc} 
      />
    </div>
  );
}
