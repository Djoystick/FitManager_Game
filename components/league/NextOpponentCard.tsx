'use client';

import React, { useState } from 'react';
import { Shield, Activity, Users, X } from 'lucide-react';
import { PlayMatchButton } from './PlayMatchButton';

interface Player {
  name: string;
  position: string;
  ovr: number;
}

interface NextOpponentCardProps {
  opponentTeamName: string;
  opponentLogoUrl?: string;
  averageOvr: number;
  starting11: Player[];
}

export function NextOpponentCard({ opponentTeamName, opponentLogoUrl, averageOvr, starting11 }: NextOpponentCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-black/60 border border-neon-cyan/30 rounded-xl p-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(0,240,255,0.1)] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="w-16 h-16 rounded-full bg-gray-900 border-2 border-neon-cyan flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.5)] overflow-hidden">
            {opponentLogoUrl ? (
              <img src={opponentLogoUrl} alt={opponentTeamName} className="w-full h-full object-cover" />
            ) : (
              <Shield className="text-neon-cyan w-8 h-8" />
            )}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neon-cyan font-bold mb-1">Next Opponent</h3>
            <p className="text-xl font-orbitron font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">
              {opponentTeamName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1">
                <Activity size={12} className="text-neon-pink" />
                Avg OVR: <strong className="text-white">{averageOvr}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 z-10 w-full md:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded font-bold transition-all"
          >
            <Users size={16} />
            Analyze Opponent
          </button>
          
          <div className="flex-1 sm:flex-none flex">
            <PlayMatchButton />
          </div>
        </div>
      </div>

      {/* Opponent Analysis Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-neon-cyan/50 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-orbitron font-bold text-white flex items-center gap-2">
                <Shield className="text-neon-cyan" size={20} />
                Scout Report
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-sm text-gray-400 mb-4 text-center">
                Starting Lineup for <strong className="text-neon-cyan">{opponentTeamName}</strong>
              </div>
              
              <div className="space-y-2">
                {starting11.map((player, idx) => {
                  // Color coding based on position
                  const isGK = player.position === 'GK';
                  const isDEF = player.position === 'DEF' || player.position === 'CB' || player.position === 'LB' || player.position === 'RB';
                  const isMID = player.position === 'MID' || player.position === 'CM' || player.position === 'CAM' || player.position === 'CDM';
                  const isFWD = player.position === 'FWD' || player.position === 'ST' || player.position === 'LW' || player.position === 'RW';

                  let posColor = 'text-gray-400 border-gray-700';
                  if (isGK) posColor = 'text-yellow-500 border-yellow-500/50';
                  if (isDEF) posColor = 'text-blue-400 border-blue-400/50';
                  if (isMID) posColor = 'text-green-400 border-green-400/50';
                  if (isFWD) posColor = 'text-red-400 border-red-400/50';

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-black/40 border border-gray-800 rounded">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold w-10 text-center px-1 py-0.5 rounded border ${posColor} bg-black/50`}>
                          {player.position}
                        </span>
                        <span className="text-gray-200 font-medium truncate max-w-[150px]">
                          {player.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">OVR</span>
                        <span className="font-orbitron font-bold text-white bg-gray-800 px-2 py-1 rounded">
                          {player.ovr}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {starting11.length === 0 && (
                  <div className="text-center text-gray-500 p-4">
                    Lineup data is currently unavailable.
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-800 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
