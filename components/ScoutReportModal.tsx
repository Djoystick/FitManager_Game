'use client';

import { useEffect } from 'react';
import { ScoutReport } from '@/app/actions/scoutActions';
import { ShieldAlert, Crosshair, X, User } from 'lucide-react';

interface ScoutReportModalProps {
  report: ScoutReport | null;
  onClose: () => void;
}

export function ScoutReportModal({ report, onClose }: ScoutReportModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-gray-900 border-2 border-neon-cyan rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.2)] flex flex-col relative animate-in fade-in zoom-in duration-300 max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-neon-cyan/20 to-transparent p-5 text-center border-b border-neon-cyan/30 relative shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-neon-cyan/70 hover:text-neon-cyan transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-black border border-neon-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Crosshair className="w-6 h-6 text-neon-cyan" />
            </div>
          </div>
          
          <h2 className="text-lg font-black uppercase tracking-widest text-white font-orbitron">
            Intel Report
          </h2>
          <p className="text-xs text-neon-cyan uppercase tracking-widest mt-1">
            Target: {report?.opponent_team_name || 'Unknown'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/50">
          {!report || report.players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm uppercase tracking-widest font-bold">Scouts found no intel</p>
              <p className="text-xs mt-2 text-center">Data is restricted or opponent roster is empty.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 border-b border-gray-800 pb-2">
                <div className="w-12 text-center">POS</div>
                <div className="flex-1">OPERATIVE</div>
                <div className="w-16 text-center text-neon-cyan">EST. OVR</div>
              </div>
              
              {report.players
                .sort((a, b) => b.ovr_estimated - a.ovr_estimated)
                .map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors">
                  <div className={`w-10 h-10 rounded flex items-center justify-center font-black text-xs shrink-0 ${
                    player.position === 'GK' ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-500/30' :
                    ['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(player.position) ? 'bg-blue-900/30 text-blue-400 border border-blue-400/30' :
                    ['MID', 'CM', 'CDM', 'CAM', 'RM', 'LM'].includes(player.position) ? 'bg-green-900/30 text-green-400 border border-green-400/30' :
                    'bg-red-900/30 text-red-400 border border-red-400/30'
                  }`}>
                    {player.position || 'N/A'}
                  </div>
                  
                  <div className="flex-1 min-w-0 px-3">
                    <div className="text-sm font-bold text-white truncate">{player.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {player.traits?.length > 0 ? player.traits.join(', ') : 'No known traits'}
                    </div>
                  </div>
                  
                  <div className="w-16 flex flex-col items-center justify-center shrink-0">
                    <div className="text-lg font-black text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
                      {player.ovr_estimated}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-900 border-t border-neon-cyan/30 shrink-0">
          <p className="text-[10px] text-gray-500 text-center mb-3 font-mono leading-tight">
            WARNING: Stats are estimated based on visual observation (rounded to nearest 5). Actual performance may vary.
          </p>
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-black border border-neon-cyan text-neon-cyan font-black uppercase tracking-widest hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
