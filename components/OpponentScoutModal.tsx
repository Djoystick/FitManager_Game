'use client';

import { useEffect, useState } from 'react';
import { getOpponentScoutReportByTeamId, ScoutReport } from '@/app/actions/scoutActions';
import { CyberLoader } from '@/components/ui/CyberLoader';
import { X, Target, Shield, Activity, Users } from 'lucide-react';

interface OpponentScoutModalProps {
  userTeamId: string;
  opponentTeamId: string;
  opponentTeamName: string;
  onClose: () => void;
}

export function OpponentScoutModal({ userTeamId, opponentTeamId, opponentTeamName, onClose }: OpponentScoutModalProps) {
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadScout() {
      setIsLoading(true);
      const res = await getOpponentScoutReportByTeamId(userTeamId, opponentTeamId);
      if (mounted) {
        if (res.success && res.data) {
          setReport(res.data);
        } else {
          setError(res.error || 'Failed to load scout report');
        }
        setIsLoading(false);
      }
    }
    loadScout();
    return () => { mounted = false; };
  }, [userTeamId, opponentTeamId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-gray-900 border-2 border-neon-cyan/50 rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.2)] flex flex-col relative animate-in fade-in zoom-in duration-300 max-h-[80vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-neon-cyan/10 to-transparent p-4 border-b border-neon-cyan/20 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-neon-cyan uppercase tracking-widest font-bold flex items-center gap-1">
              <Activity size={12} /> SCOUT REPORT
            </span>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">{opponentTeamName}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <CyberLoader size="sm" />
              <p className="text-neon-cyan mt-4 text-xs font-bold uppercase tracking-widest animate-pulse">Gathering Intel...</p>
            </div>
          ) : error || !report ? (
            <div className="py-12 text-center text-red-500 font-bold text-sm">
              {error || 'No data available'}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/50 border border-gray-800 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Est. Power</span>
                  <span className="text-2xl font-black text-neon-green drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
                    {report.fog_level === 'hidden' ? '???' : report.team_ovr_estimated}
                  </span>
                </div>
                <div className="bg-black/50 border border-gray-800 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Intel Quality</span>
                  <span className={`text-sm font-black uppercase mt-1 ${report.fog_level === 'full' ? 'text-neon-green' : report.fog_level === 'partial' ? 'text-yellow-500' : 'text-red-500'}`}>
                    {report.fog_level === 'full' ? 'HIGH' : report.fog_level === 'partial' ? 'MEDIUM' : 'LOW'}
                  </span>
                </div>
              </div>

              {/* Roster */}
              <div className="bg-black/50 border border-gray-800 rounded-lg p-3">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users size={12} /> Detected Lineup
                </h3>
                
                {report.fog_level === 'hidden' ? (
                  <div className="text-center py-6 text-gray-600 text-xs uppercase tracking-widest">
                    Upgrade Scouting Facility to reveal lineup
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {report.players.slice(0, 11).map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between p-2 rounded-md bg-gray-900 border border-gray-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-[10px] font-bold w-6 text-center rounded ${p.position === 'GK' ? 'bg-yellow-900/50 text-yellow-500' : p.position.includes('B') ? 'bg-blue-900/50 text-blue-400' : p.position.includes('M') ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {p.position}
                          </span>
                          <span className="text-sm font-bold text-gray-300 truncate">{p.name}</span>
                        </div>
                        <span className="text-sm font-black font-orbitron text-white">{p.ovr_estimated}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
