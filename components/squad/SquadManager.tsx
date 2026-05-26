'use client';

import React, { useOptimistic, useTransition, useState, DragEvent } from 'react';
import { PlayerCard } from '@/components/squad/PlayerCard';
import { updateLineupStatus } from '@/app/actions/squadActions';

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
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // useOptimistic hook to instantly update UI on drag-and-drop
  const [optimisticPlayers, addOptimisticUpdate] = useOptimistic(
    initialPlayers,
    (state: Player[], update: { playerId: string; newStatus: string }) => {
      return state.map(p =>
        p.id === update.playerId ? { ...p, lineup_status: update.newStatus } : p
      );
    }
  );

  const starting = optimisticPlayers.filter(p => p.lineup_status === 'starting');
  const bench = optimisticPlayers.filter(p => p.lineup_status === 'bench');

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
      addOptimisticUpdate({ playerId, newStatus: targetZone });
      
      const res = await updateLineupStatus(playerId, teamId, targetZone);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
        setTimeout(() => setErrorMsg(null), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Toast Notification for Errors */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm backdrop-blur-sm animate-in slide-in-from-top-2">
          {errorMsg}
        </div>
      )}

      {/* Starting 11 Zone */}
      <div 
        className="flex flex-col gap-4 p-4 rounded-xl border border-dashed border-transparent transition-all duration-300 hover:border-neon-green/30"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'starting')}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]">
            Starting 11
          </h2>
          <span className={`text-xs font-bold ${starting.length > 11 ? 'text-red-500' : 'text-gray-500'}`}>
            {starting.length}/11
          </span>
        </div>
        
        {starting.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {starting.map(player => (
              <div 
                key={player.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, player.id)}
                className="cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform"
              >
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-gray-700/50 rounded-lg text-gray-500 text-sm bg-black/20">
            Drag players here to add to starting lineup.
          </div>
        )}
      </div>

      {/* Bench Zone */}
      <div 
        className="flex flex-col gap-4 p-4 rounded-xl border border-dashed border-transparent transition-all duration-300 hover:border-gray-600"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'bench')}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
            Bench / Reserves
          </h2>
          <span className="text-xs text-gray-500 font-bold">{bench.length} Players</span>
        </div>
        
        {bench.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 opacity-80 hover:opacity-100 transition-opacity">
            {bench.map(player => (
              <div 
                key={player.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, player.id)}
                className="cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform"
              >
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-gray-800/50 rounded-lg text-gray-600 text-sm bg-black/20">
            Drag players here to move them to the bench.
          </div>
        )}
      </div>
    </div>
  );
}
