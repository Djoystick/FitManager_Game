'use client';

import React, { useOptimistic, useTransition, useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PlayerCard } from '@/components/squad/PlayerCard';
import { updateLineupStatus } from '@/app/actions/squadActions';
import { listPlayerAction } from '@/app/actions/marketActions';

interface Player {
  id: string;
  name: string;
  position: string;
  ovr: number;
  stamina: number;
  lineup_status?: string;
  is_nft_coach?: boolean;
  traits?: string[];
}

interface SquadManagerProps {
  initialPlayers: Player[];
  teamId: string;
}

export function SquadManager({ initialPlayers, teamId }: SquadManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sellModalPlayer, setSellModalPlayer] = useState<Player | null>(null);
  const [sellPrice, setSellPrice] = useState<string>('');

  // useOptimistic hook to instantly update UI on drag-and-drop
  const [optimisticPlayers, addOptimisticUpdate] = useOptimistic(
    initialPlayers,
    (state: Player[], update: { action: 'move' | 'remove'; playerId: string; newStatus?: string }) => {
      if (update.action === 'remove') {
        return state.filter(p => p.id !== update.playerId);
      }
      return state.map(p =>
        p.id === update.playerId ? { ...p, lineup_status: update.newStatus } : p
      );
    }
  );

  const starting = optimisticPlayers.filter(p => p.lineup_status === 'starting');
  const bench = optimisticPlayers.filter(p => p.lineup_status === 'bench' || p.lineup_status === 'reserve' || !p.lineup_status);

  const handleSellClick = (player: Player) => {
    if (optimisticPlayers.length <= 11) {
      setErrorMsg('Cannot sell player: Minimum active squad size is 11.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setSellModalPlayer(player);
    setSellPrice('');
  };

  const handleConfirmSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellModalPlayer || !sellPrice) return;
    
    const priceTon = parseFloat(sellPrice);
    if (isNaN(priceTon) || priceTon <= 0) {
      setErrorMsg('Invalid price');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const playerToSell = sellModalPlayer;
    setSellModalPlayer(null);

    startTransition(async () => {
      addOptimisticUpdate({ action: 'remove', playerId: playerToSell.id });
      
      const res = await listPlayerAction(playerToSell.id, priceTon);
      if (res.success) {
        router.refresh(); // Sync with server so it updates active tabs
      } else {
        setErrorMsg(res.error || 'Failed to list player');
        setTimeout(() => setErrorMsg(null), 3000);
        router.refresh(); // Revert optimistic removal
      }
    });
  };

  // Drag Handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, playerId: string) => {
    e.dataTransfer.setData('playerId', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetZone: 'starting' | 'bench') => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    if (!playerId) return;

    const player = optimisticPlayers.find(p => p.id === playerId);
    if (!player || player.lineup_status === targetZone) return;

    // Enforce 11 players limit client-side first for better UX
    if (targetZone === 'starting' && starting.length >= 11) {
      setErrorMsg('Maximum of 11 starting players allowed.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    startTransition(async () => {
      addOptimisticUpdate({ action: 'move', playerId, newStatus: targetZone });
      
      const res = await updateLineupStatus(playerId, teamId, targetZone);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
        setTimeout(() => setErrorMsg(null), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      
      {/* Toast Notification for Errors */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-xl 
                       shadow-[0_0_20px_rgba(239,68,68,0.4)] font-bold text-sm backdrop-blur-xl 
                       border border-red-400/30 animate-in slide-in-from-top-2">
          {errorMsg}
        </div>
      )}

      {/* Starting 11 Zone — Glass Panel */}
      <div 
        className="flex flex-col gap-4 p-4 rounded-2xl border border-emerald-500/20 backdrop-blur-xl
                   transition-all duration-300 hover:border-emerald-400/40 hover:shadow-[0_0_30px_rgba(52,211,153,0.08)]"
        style={{
          background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(255,255,255,0.03) 100%)',
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'starting')}
      >
        {/* Glass highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent rounded-2xl" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300 font-orbitron">
              Starting 11
            </h2>
          </div>
          <span className={`text-[10px] font-black font-orbitron ${starting.length > 11 ? 'text-red-400' : 'text-emerald-400/60'}`}>
            {starting.length}/11
          </span>
        </div>
        
        {starting.length > 0 ? (
          <div className="grid grid-cols-2 min-[400px]:grid-cols-3 min-[440px]:grid-cols-4 gap-2.5">
            {starting.map(player => (
              <div 
                key={player.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, player.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                <PlayerCard player={player} onSell={() => handleSellClick(player)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-emerald-500/20 rounded-2xl text-emerald-400/50 text-xs 
                         bg-emerald-500/5 backdrop-blur-sm">
            Drag players here to add to starting lineup
          </div>
        )}
      </div>

      {/* Bench Zone — Glass Panel */}
      <div 
        className="flex flex-col gap-4 p-4 rounded-2xl border border-white/10 backdrop-blur-xl
                   transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'bench')}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-2xl" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 font-orbitron">
              Bench / Reserves
            </h2>
          </div>
          <span className="text-[10px] text-gray-500 font-black font-orbitron">{bench.length}</span>
        </div>
        
        {bench.length > 0 ? (
          <div className="grid grid-cols-2 min-[400px]:grid-cols-3 min-[440px]:grid-cols-4 gap-2.5 opacity-80 hover:opacity-100 transition-opacity">
            {bench.map(player => (
              <div 
                key={player.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, player.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                <PlayerCard player={player} onSell={() => handleSellClick(player)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-gray-600 text-xs 
                         bg-white/5 backdrop-blur-sm">
            Drag players here to move them to the bench
          </div>
        )}
      </div>

      {/* Sell Player Modal — Glassmorphism */}
      {sellModalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
          <div className="w-full max-w-sm flex flex-col relative rounded-2xl border border-white/10 backdrop-blur-2xl overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(15,15,30,0.98) 0%, rgba(8,8,20,1) 100%)',
                 boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
               }}>
            {/* Glass highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <button 
              onClick={() => setSellModalPlayer(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 border border-white/10 
                         flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10
                         transition-all duration-200 active:scale-90 z-10"
            >
              ✕
            </button>
            
            <div className="p-6">
              <h2 className="text-lg font-black uppercase tracking-wider mb-1 text-white font-orbitron">Sell Player</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-5">
                List <span className="text-white font-bold">{sellModalPlayer.name}</span> on the transfer market
              </p>
              
              <form onSubmit={handleConfirmSell} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Price (TON)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">💎</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white 
                                 focus:border-cyan-400/50 focus:bg-white/8 outline-none font-orbitron
                                 transition-all duration-200"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 mt-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 
                             text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 
                             shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)]
                             active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Processing...' : 'List on Market'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
