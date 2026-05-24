'use client';

import React, { useState, useTransition } from 'react';
import { scoutYouthPlayer, Player } from '@/app/actions/scoutingActions';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { PlayerCard } from '@/components/squad/PlayerCard';

export function ScoutPlayerButton() {
  const [isPending, startTransition] = useTransition();
  const [scoutedPlayer, setScoutedPlayer] = useState<Player | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleScout = () => {
    setErrorMsg(null);
    setScoutedPlayer(null);
    
    startTransition(async () => {
      const res = await scoutYouthPlayer();
      if (res.success && res.player) {
        setScoutedPlayer(res.player);
      } else {
        setErrorMsg(res.error || 'Failed to scout a player.');
      }
    });
  };

  const resetScout = () => {
    setScoutedPlayer(null);
    setErrorMsg(null);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto mt-8">
      
      {!scoutedPlayer && (
        <button
          onClick={handleScout}
          disabled={isPending}
          className="relative group w-full px-8 py-6 bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 border border-neon-purple/50 hover:border-neon-cyan text-white font-orbitron font-bold uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(188,19,254,0.3)] hover:shadow-[0_0_35px_rgba(0,240,255,0.5)] transition-all overflow-hidden flex flex-col items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-wait"
        >
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          
          {isPending ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-t-2 border-neon-cyan animate-spin"></div>
                <Search className="w-12 h-12 text-neon-cyan opacity-50" />
              </div>
              <span className="text-neon-cyan animate-pulse">Searching global network...</span>
            </>
          ) : (
            <>
              <Search className="w-12 h-12 text-neon-purple group-hover:text-neon-cyan group-hover:scale-110 transition-all duration-300" />
              <span>Scout Youth Talent</span>
            </>
          )}
        </button>
      )}

      {errorMsg && (
        <div className="w-full bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-center text-sm font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          {errorMsg}
        </div>
      )}

      {/* Success Modal / Display */}
      {scoutedPlayer && (
        <div className="w-full bg-space-dark border border-neon-green/30 rounded-2xl p-6 flex flex-col items-center gap-6 shadow-[0_0_30px_rgba(57,255,20,0.15)] animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-2 text-neon-green font-orbitron tracking-widest uppercase">
            <Sparkles size={24} />
            <span className="font-black text-lg">Talent Found!</span>
          </div>

          <div className="w-full max-w-[200px] animate-in zoom-in-50 duration-700">
            {/* Re-use the PlayerCard component */}
            <PlayerCard player={scoutedPlayer as any} />
          </div>

          <p className="text-sm text-gray-400 text-center">
            <span className="font-bold text-white">{scoutedPlayer.name}</span> has joined your academy and was added to the bench.
          </p>

          <button 
            onClick={resetScout}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors uppercase tracking-widest text-sm flex items-center justify-center gap-2"
          >
            <X size={16} />
            Close
          </button>
        </div>
      )}
    </div>
  );
}
