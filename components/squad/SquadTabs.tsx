'use client';

import { useState, useEffect } from 'react';
import { SquadManager } from './SquadManager';
import { getUpcomingOpponentScoutReport, ScoutReport } from '@/app/actions/scoutActions';
import { ShieldAlert, Crosshair } from 'lucide-react';

export function SquadTabs({ initialPlayers, teamId, userId }: { initialPlayers: any[], teamId: string, userId: string }) {
  const [activeTab, setActiveTab] = useState<'lineup' | 'scout'>('lineup');
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [isLoadingScout, setIsLoadingScout] = useState(false);

  useEffect(() => {
    if (activeTab === 'scout' && !report) {
      setIsLoadingScout(true);
      getUpcomingOpponentScoutReport(userId).then(res => {
        if (res.success && res.data) {
          setReport(res.data);
        }
        setIsLoadingScout(false);
      });
    }
  }, [activeTab, userId, report]);

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex bg-black/40 border border-gray-800 p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('lineup')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'lineup' ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
        >
          Lineup
        </button>
        <button 
          onClick={() => setActiveTab('scout')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${activeTab === 'scout' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-gray-400 hover:text-white'}`}
        >
          Scout Intel
        </button>
      </div>

      {/* Content */}
      {activeTab === 'lineup' ? (
        <SquadManager initialPlayers={initialPlayers} teamId={teamId} />
      ) : (
        <div className="flex flex-col border border-gray-800 bg-black/60 rounded-xl overflow-hidden min-h-[300px] animate-in fade-in duration-300">
          {isLoadingScout ? (
            <div className="flex-1 flex justify-center items-center py-12">
               <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !report || report.players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-500">
              <ShieldAlert className="w-12 h-12 mb-4 opacity-50 text-red-500" />
              <p className="text-sm uppercase tracking-widest font-bold">Scouts found no intel</p>
              <p className="text-xs mt-2 text-center max-w-xs">Data is restricted or opponent roster is empty.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="bg-gradient-to-r from-red-900/30 to-transparent p-4 border-b border-red-900/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-black border border-red-500 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <Crosshair className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-white text-lg font-black uppercase tracking-wider font-orbitron">{report.opponent_team_name}</h3>
                    <p className="text-[10px] text-red-400 uppercase tracking-widest">Next Target (Round {report.round_number})</p>
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between px-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 border-b border-gray-800 pb-2">
                  <div className="w-10 text-center">POS</div>
                  <div className="flex-1 px-3">OPERATIVE</div>
                  <div className="w-16 text-center text-red-500">EST. OVR</div>
                </div>
                
                {report.players.sort((a, b) => b.ovr_estimated - a.ovr_estimated).map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center font-black text-xs text-gray-400 border border-gray-700 shrink-0">
                      {player.position || 'N/A'}
                    </div>
                    
                    <div className="flex-1 min-w-0 px-3">
                      <div className="text-sm font-bold text-white truncate">{player.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {player.traits?.length > 0 ? player.traits.join(', ') : 'No known traits'}
                      </div>
                    </div>
                    
                    <div className="w-16 flex flex-col items-center justify-center shrink-0">
                      <div className="text-lg font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                        {player.ovr_estimated}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-red-900/10 border-t border-red-900/30 text-[10px] text-red-400/70 text-center font-mono uppercase tracking-widest">
                WARNING: Stats are estimated based on visual observation.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
