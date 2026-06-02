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

  // Bench drawer state
  const [isBenchOpen, setIsBenchOpen] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#05060f' }}>
      {/* ── Background decorations ── */}
      <div className="absolute inset-0 pointer-events-none bg-grid-violet opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(147,51,234,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(147,51,234,0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(147,51,234,0.08)_0%,transparent_100%)]" />

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
        <div className="flex flex-col items-end">
          <div className="text-[8px] uppercase tracking-widest text-gray-600 font-bold">OVR</div>
          <div className="text-2xl font-black font-orbitron text-emerald-300 neon-text-green leading-none">{averageOvr}</div>
        </div>
      </header>

      {/* TABS */}
      <div className="flex justify-center mt-1.5 mb-1 z-10 relative shrink-0 px-3">
        <div className="glass-card flex w-full p-0.5 gap-0.5">
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
          <div className="flex justify-center gap-1.5 shrink-0 z-20 mt-0.5 mb-1.5 px-3">
            {['4-4-2', '4-3-3', '3-5-2'].map(f => {
              const isRealActive = currentFormation === f;
              return (
                <button
                  key={f}
                  onClick={() => handleFormationChange(f)}
                  disabled={isFormationLoading}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                    isRealActive
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/50 shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                      : 'glass-card text-gray-600 hover:text-gray-300'
                  } ${isFormationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div className={`flex-1 relative w-[96%] mx-auto rounded-xl overflow-hidden flex flex-col items-center justify-around transition-opacity duration-300 ${isFormationLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`}
               style={{ background: 'linear-gradient(180deg, rgba(0,30,10,0.8) 0%, rgba(0,50,15,0.6) 40%, rgba(0,50,15,0.6) 60%, rgba(0,30,10,0.8) 100%)', border: '1px solid rgba(57,255,20,0.25)', boxShadow: 'inset 0 0 40px rgba(57,255,20,0.04), 0 0 20px rgba(0,0,0,0.4)' }}>
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
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="bottom-sheet z-[60] pb-20"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              <div className="px-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-violet-300">Скамейка</span>
                </div>
                {activePlayers.filter(p => p.lineup_status === 'reserve').length > 0 && (
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest">Резерв →</span>
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setActiveHUD(null)}
            />

            {/* Popover Menu */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.85, x: '-50%', y: activeHUD.isBelow ? '-50%' : '-80%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: activeHUD.isBelow ? '0%' : '-100%' }}
              exit={{ opacity: 0, scale: 0.85, x: '-50%', y: activeHUD.isBelow ? '-50%' : '-80%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed z-50 glass-card-violet rounded-2xl p-3 flex flex-row gap-2"
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

      {/* Legend Modal */}
      {showLegend && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={() => setShowLegend(false)}
        >
          <div
            className="w-full max-w-[480px] glass-card-violet rounded-b-none p-6 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider flex items-center gap-2 font-orbitron">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
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
