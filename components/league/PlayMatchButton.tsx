'use client';

import React, { useState, useTransition } from 'react';
import { simulateMatch, MatchResult } from '@/app/actions/matchActions';
import { Loader2, Swords, Trophy, Frown, Equal } from 'lucide-react';

export function PlayMatchButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MatchResult | null>(null);

  const handlePlayMatch = () => {
    startTransition(async () => {
      const res = await simulateMatch();
      setResult(res);
    });
  };

  const closeModal = () => setResult(null);

  return (
    <>
      <button
        onClick={handlePlayMatch}
        disabled={isPending}
        className="relative group w-full md:w-auto px-8 py-4 bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/50 hover:border-neon-cyan text-white font-orbitron font-bold uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all overflow-hidden flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            <span>Simulating...</span>
          </>
        ) : (
          <>
            <Swords className="w-5 h-5 text-neon-cyan group-hover:scale-110 transition-transform" />
            <span>Play Match</span>
          </>
        )}
      </button>

      {/* Match Result Modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-space-dark border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40">
              <h3 className="font-orbitron font-bold text-white tracking-widest uppercase">
                Match Result
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center gap-6">
              {!result.success ? (
                <div className="text-center flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/50">
                    <span className="text-red-500 text-3xl font-black">!</span>
                  </div>
                  <p className="text-red-400 font-medium">{result.error}</p>
                </div>
              ) : (
                <>
                  {/* Scoreline */}
                  <div className="flex items-center justify-center gap-6 w-full">
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">You</span>
                      <span className="text-5xl font-black font-orbitron text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                        {result.homeScore}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-2">OVR: {result.homePower}</span>
                    </div>

                    <div className="text-2xl font-black text-gray-700">-</div>

                    <div className="flex flex-col items-center flex-1">
                      <span className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Bot</span>
                      <span className="text-5xl font-black font-orbitron text-gray-400">
                        {result.awayScore}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-2">OVR: {result.awayPower}</span>
                    </div>
                  </div>

                  {/* Outcome Indicator */}
                  <div className="flex flex-col items-center gap-2 w-full py-4 border-t border-b border-gray-800/50 bg-black/20">
                    {result.homeScore! > result.awayScore! ? (
                      <div className="flex items-center gap-2 text-neon-green">
                        <Trophy size={20} />
                        <span className="font-bold tracking-widest uppercase">Victory</span>
                      </div>
                    ) : result.homeScore! === result.awayScore! ? (
                      <div className="flex items-center gap-2 text-yellow-500">
                        <Equal size={20} />
                        <span className="font-bold tracking-widest uppercase">Draw</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-500">
                        <Frown size={20} />
                        <span className="font-bold tracking-widest uppercase">Defeat</span>
                      </div>
                    )}
                  </div>

                  {/* Stamina Info */}
                  <div className="text-center">
                    <p className="text-sm text-gray-400">
                      Starting 11 players lost <span className="text-yellow-500 font-bold">{result.staminaDrained}</span> stamina points.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-black/60">
              <button 
                onClick={closeModal}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
